import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { createServerClient } from "@/lib/supabase/server"

// Microsoft OAuth endpoints using tenant ID from env
const MICROSOFT_AUTH_URL = `https://login.microsoftonline.com/${process.env.MICROSOFT_TENANT_ID}/oauth2/v2.0/authorize`
const MICROSOFT_TOKEN_URL = `https://login.microsoftonline.com/${process.env.MICROSOFT_TENANT_ID}/oauth2/v2.0/token`
const MICROSOFT_GRAPH_URL = "https://graph.microsoft.com/v1.0/me"

// Generate PKCE challenge
function generateCodeChallenge() {
  const codeVerifier = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "")

  return codeVerifier
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get("code")
  const errorParam = searchParams.get("error")

  // Handle OAuth callback
  if (code) {
    try {
      const supabaseAdmin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      })

      // Get code verifier from state (in production, store this securely)
      const codeVerifier = searchParams.get("state")

      if (!codeVerifier) {
        console.error("Code verifier not found")
        return NextResponse.redirect(`${process.env.NEXT_PUBLIC_SITE_URL}/auth/login?error=code_verifier_not_found`)
      }

      console.log("Exchanging code for token...")

      // Exchange code for token
      const tokenResponse = await fetch(MICROSOFT_TOKEN_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          client_id: process.env.MICROSOFT_CLIENT_ID!,
          client_secret: process.env.MICROSOFT_CLIENT_SECRET!,
          code,
          redirect_uri: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/microsoft`,
          grant_type: "authorization_code",
          code_verifier: codeVerifier,
        }),
      })

      const tokenData = await tokenResponse.json()

      if (!tokenResponse.ok) {
        console.error("Token exchange failed:", tokenData)
        return NextResponse.redirect(`${process.env.NEXT_PUBLIC_SITE_URL}/auth/login?error=token_exchange_failed`)
      }

      console.log("Token exchange successful, fetching user info...")

      // Get user info from Microsoft Graph
      const userResponse = await fetch(MICROSOFT_GRAPH_URL, {
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
        },
      })

      const userData = await userResponse.json()

      if (!userResponse.ok) {
        console.error("User info fetch failed:", userData)
        return NextResponse.redirect(`${process.env.NEXT_PUBLIC_SITE_URL}/auth/login?error=user_info_failed`)
      }

      console.log("Microsoft user data:", userData)

      console.log("Checking environment variables...")
      console.log("SUPABASE_URL:", process.env.SUPABASE_URL ? "✓ Set" : "✗ Missing")
      console.log("SUPABASE_SERVICE_ROLE_KEY:", process.env.SUPABASE_SERVICE_ROLE_KEY ? "✓ Set" : "✗ Missing")

      console.log("SUPABASE_URL value:", process.env.SUPABASE_URL?.substring(0, 30) + "...")
      console.log("SERVICE_ROLE_KEY starts with:", process.env.SUPABASE_SERVICE_ROLE_KEY?.substring(0, 20) + "...")

      if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
        console.error("Missing required Supabase environment variables")
        return NextResponse.redirect(`${process.env.NEXT_PUBLIC_SITE_URL}/auth/login?error=supabase_config_missing`)
      }

      console.log("Creating Supabase admin client...")

      const userEmail = userData.mail || userData.userPrincipalName

      if (!userEmail) {
        console.error("No email found in Microsoft user data")
        return NextResponse.redirect(`${process.env.NEXT_PUBLIC_SITE_URL}/auth/login?error=no_email_found`)
      }

      console.log("Creating/updating user with email:", userEmail)

      let userId: string
      let isNewUser = false

      // First, check if user already exists
      let page = 1
      let foundUser = null
      const normalizedEmail = userEmail.toLowerCase()

      while (!foundUser) {
        const { data: usersPage, error: listError } = await supabaseAdmin.auth.admin.listUsers({
          page,
          perPage: 1000,
        })

        if (listError) {
          console.error("Error listing users:", listError)
          return NextResponse.redirect(`${process.env.NEXT_PUBLIC_SITE_URL}/auth/login?error=user_lookup_failed`)
        }

        if (usersPage?.users && usersPage.users.length > 0) {
          foundUser = usersPage.users.find((user) => user.email?.toLowerCase() === normalizedEmail)

          console.log(`Searched page ${page} with ${usersPage.users.length} users, looking for: ${normalizedEmail}`)

          if (foundUser || usersPage.users.length < 1000) {
            break
          }

          page++

          if (page > 100) {
            console.error("Reached maximum page limit while searching for user")
            break
          }
        } else {
          console.log("No users found in this page")
          break
        }
      }

      if (foundUser) {
        // User exists, allow sign in regardless of registration setting
        userId = foundUser.id
        console.log("Found existing user with ID:", userId)
      } else {
        // User doesn't exist, check if registration is enabled
        const { data: settings, error: settingsError } = await supabaseAdmin
          .from("system_settings")
          .select("setting_value")
          .eq("key", "user_registration_enabled")
          .single()

        if (!settingsError && settings) {
          const isEnabled = settings.setting_value === "true" || settings.setting_value === true
          if (!isEnabled) {
            console.log("User registration is disabled, blocking new Microsoft OAuth registration")
            return NextResponse.redirect(`${process.env.NEXT_PUBLIC_SITE_URL}/auth/login?error=registration_disabled`)
          }
        }

        // Registration is enabled, create new user
        isNewUser = true
        console.log("Attempting to create new user...")
        const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
          email: userEmail,
          email_confirm: true,
          user_metadata: {
            full_name: userData.displayName,
            provider: "microsoft",
            microsoft_id: userData.id,
            avatar_url: userData.photo || null,
          },
        })

        if (createError) {
          console.error("User creation error:", createError)
          console.error("Full error details:", JSON.stringify(createError, null, 2))
          return NextResponse.redirect(`${process.env.NEXT_PUBLIC_SITE_URL}/auth/login?error=user_creation_failed`)
        }

        if (!newUser?.user) {
          console.error("User creation succeeded but no user returned")
          return NextResponse.redirect(`${process.env.NEXT_PUBLIC_SITE_URL}/auth/login?error=user_creation_failed`)
        }

        userId = newUser.user.id
        console.log("Created new user with ID:", userId)
      }

      console.log("User ID:", userId, "- generating session...")

      // Create a server client for proper session management
      const supabase = await createServerClient()

      // Generate a temporary password for the user to sign in
      const tempPassword = crypto.randomUUID()

      // Update user with temporary password
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        password: tempPassword,
      })

      if (updateError) {
        console.error("Error updating user password:", updateError)
        return NextResponse.redirect(`${process.env.NEXT_PUBLIC_SITE_URL}/auth/login?error=session_failed`)
      }

      // Sign in the user with the temporary password to establish session
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: userEmail,
        password: tempPassword,
      })

      if (signInError) {
        console.error("Error signing in user:", signInError)
        return NextResponse.redirect(`${process.env.NEXT_PUBLIC_SITE_URL}/auth/login?error=session_failed`)
      }

      console.log("Session established successfully, redirecting to dashboard...")

      // Create response with redirect
      const response = NextResponse.redirect(`${process.env.NEXT_PUBLIC_SITE_URL}/dashboard`)

      // The session cookies are automatically set by the supabase client
      return response
    } catch (error) {
      console.error("Microsoft OAuth error:", error)
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_SITE_URL}/auth/login?error=oauth_failed`)
    }
  }

  // Handle OAuth errors
  if (errorParam) {
    console.error("Microsoft OAuth error:", errorParam)
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_SITE_URL}/auth/login?error=${errorParam}`)
  }

  // Initiate OAuth flow
  const codeVerifier = generateCodeChallenge()
  const state = codeVerifier // In production, use a more secure state parameter

  const authUrl = new URL(MICROSOFT_AUTH_URL)
  authUrl.searchParams.set("client_id", process.env.MICROSOFT_CLIENT_ID!)
  authUrl.searchParams.set("response_type", "code")
  authUrl.searchParams.set("redirect_uri", `${process.env.NEXT_PUBLIC_SITE_URL}/auth/microsoft`)
  authUrl.searchParams.set("scope", "openid email profile User.Read")
  authUrl.searchParams.set("state", state)
  authUrl.searchParams.set("code_challenge", codeVerifier)
  authUrl.searchParams.set("code_challenge_method", "plain")

  console.log("Initiating Microsoft OAuth flow...")
  return NextResponse.redirect(authUrl.toString())
}
