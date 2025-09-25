"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Leaf, Loader2, CheckCircle, AlertCircle, ExternalLink, Mail } from "lucide-react"
import Link from "next/link"

export default function AuthCallbackPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [errorType, setErrorType] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        const oauthError = searchParams.get("error")
        const errorCode = searchParams.get("error_code")
        const errorDescription = searchParams.get("error_description")

        if (oauthError) {
          // Handle specific Microsoft OAuth errors
          if (errorCode === "otp_expired") {
            setErrorType("email_expired")
            throw new Error("Email verification link has expired. Please request a new verification email.")
          } else if (errorDescription?.includes("Error getting user email from external provider")) {
            setErrorType("microsoft_email_permission")
            throw new Error("Microsoft account email access denied. Please check your Azure AD app permissions.")
          } else if (errorCode === "unexpected_failure") {
            setErrorType("oauth_config")
            throw new Error("OAuth configuration error. Please check your provider settings.")
          } else {
            setErrorType("oauth_general")
            throw new Error(errorDescription || `OAuth error: ${oauthError}`)
          }
        }

        const code = searchParams.get("code")
        const type = searchParams.get("type")

        if (type === "invite") {
          const hashParams = new URLSearchParams(window.location.hash.substring(1))
          const accessToken = hashParams.get("access_token")
          const refreshToken = hashParams.get("refresh_token")
          const expiresAt = hashParams.get("expires_at")

          if (accessToken && refreshToken) {
            // Set the session using the tokens from the fragment
            const { data, error } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            })

            if (error) {
              throw new Error("Failed to authenticate invitation")
            }

            // Redirect to password setup for invitations
            router.push("/auth/accept-invitation")
            setSuccess(true)
            return
          }

          // Fallback: check if user is already authenticated
          const {
            data: { user },
            error: userError,
          } = await supabase.auth.getUser()

          if (userError || !user) {
            throw new Error("Failed to authenticate invitation")
          }

          // Redirect to password setup for invitations
          router.push("/auth/accept-invitation")
          setSuccess(true)
          return
        }

        if (code) {
          const state = searchParams.get("state")
          const isEmailVerification = !state && type !== "recovery" // Email verification doesn't have state parameter

          if (isEmailVerification) {
            // We just need to check if there's a valid session and redirect
            const { data: sessionData, error: sessionError } = await supabase.auth.getSession()

            if (sessionError || !sessionData.session) {
              // If no session, the verification might have succeeded but user needs to sign in
              router.push("/auth/login?message=verification_complete")
            } else {
              // Session exists, verification was successful
              router.push("/dashboard")
            }

            setSuccess(true)
            return
          } else {
            // For OAuth PKCE flow, pass the full URL to include both code and state parameters
            const { data, error } = await supabase.auth.exchangeCodeForSession(window.location.href)

            if (error) {
              throw error
            }

            if (type === "recovery") {
              // For password recovery, redirect to reset password
              router.push("/auth/reset-password")
            } else {
              // Default redirect to dashboard
              router.push("/dashboard")
            }

            setSuccess(true)
            return
          }
        }

        // Check if we already have a session (Supabase may have handled the exchange automatically)
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession()

        if (sessionError || !sessionData.session) {
          throw new Error("No authorization code found or session could not be established")
        }

        // Session exists, redirect appropriately
        if (type === "recovery") {
          router.push("/auth/reset-password")
        } else {
          router.push("/dashboard")
        }

        setSuccess(true)
      } catch (error: any) {
        console.error("Auth callback error:", error)
        setError(error.message || "Authentication failed")
      } finally {
        setLoading(false)
      }
    }

    handleAuthCallback()
  }, [router, searchParams, supabase.auth])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-muted/30 to-accent/10 p-4">
        <Card className="w-full max-w-md shadow-lg border-0 bg-card/80 backdrop-blur-sm">
          <CardHeader className="text-center space-y-4">
            <div className="flex items-center justify-center gap-2">
              <div className="p-2 bg-primary rounded-lg">
                <Leaf className="h-6 w-6 text-primary-foreground" />
              </div>
              <h1 className="text-2xl font-bold text-foreground">GreenLoop</h1>
            </div>
            <div className="mx-auto p-3 bg-accent/10 rounded-full w-fit">
              <Loader2 className="h-8 w-8 text-accent animate-spin" />
            </div>
            <CardTitle className="text-xl">Processing Authentication</CardTitle>
            <CardDescription>Please wait while we verify your credentials...</CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-muted/30 to-accent/10 p-4">
        <Card className="w-full max-w-lg shadow-lg border-0 bg-card/80 backdrop-blur-sm">
          <CardHeader className="text-center space-y-4">
            <div className="flex items-center justify-center gap-2 mb-4">
              <div className="p-2 bg-primary rounded-lg">
                <Leaf className="h-6 w-6 text-primary-foreground" />
              </div>
              <h1 className="text-2xl font-bold text-foreground">GreenLoop</h1>
            </div>
            <div className="mx-auto p-3 bg-destructive/10 rounded-full w-fit">
              <AlertCircle className="h-8 w-8 text-destructive" />
            </div>
            <CardTitle className="text-xl">Authentication Failed</CardTitle>
            <CardDescription className="text-balance">{error}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {errorType === "email_expired" && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm">
                <div className="flex items-center gap-2 mb-2">
                  <Mail className="h-4 w-4 text-amber-600" />
                  <h4 className="font-semibold text-amber-900">Email Verification Link Expired</h4>
                </div>
                <p className="text-amber-800 mb-3">
                  Your email verification link has expired for security reasons. Email verification links are only valid
                  for a limited time.
                </p>
                <div className="space-y-2 text-amber-700">
                  <p className="font-medium">What to do next:</p>
                  <ul className="list-disc list-inside space-y-1 ml-2">
                    <li>Go back to the registration page</li>
                    <li>Enter your email address again</li>
                    <li>Check your inbox for a new verification email</li>
                    <li>Click the new verification link promptly</li>
                  </ul>
                </div>
                <div className="mt-3 flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1 bg-transparent" asChild>
                    <Link href="/auth/register">Register Again</Link>
                  </Button>
                  <Button variant="outline" size="sm" className="flex-1 bg-transparent" asChild>
                    <Link href="/auth/login">Sign In Instead</Link>
                  </Button>
                </div>
              </div>
            )}

            {errorType === "microsoft_email_permission" && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm">
                <h4 className="font-semibold text-blue-900 mb-2">Microsoft OAuth Configuration Issue</h4>
                <p className="text-blue-800 mb-3">
                  Your Azure AD app registration doesn't have permission to access user email addresses.
                </p>
                <div className="space-y-2 text-blue-700">
                  <p className="font-medium">To fix this:</p>
                  <ol className="list-decimal list-inside space-y-1 ml-2">
                    <li>Go to Azure Portal → App registrations → Your GreenLoop app</li>
                    <li>Navigate to "API permissions"</li>
                    <li>Add "Microsoft Graph" → "User.Read" permission</li>
                    <li>Grant admin consent for the permissions</li>
                    <li>Go to "Manifest" tab and add optional claims:</li>
                    <li className="ml-4 text-xs bg-blue-100 p-2 rounded font-mono">
                      "optionalClaims": {"{"}
                      <br />
                      &nbsp;&nbsp;"idToken": [
                      <br />
                      &nbsp;&nbsp;&nbsp;&nbsp;{"{"}"name": "email", "essential": false{"}"},
                      <br />
                      &nbsp;&nbsp;&nbsp;&nbsp;{"{"}"name": "xms_edov", "essential": false{"}"},
                      <br />
                      &nbsp;&nbsp;]
                      <br />
                      {"}"}
                    </li>
                    <li>Save the manifest changes</li>
                    <li>In Supabase Dashboard → Auth → Providers → Azure, ensure "Use PKCE" is enabled</li>
                  </ol>
                </div>
                <Button variant="outline" size="sm" className="mt-3 w-full bg-transparent" asChild>
                  <Link href="https://portal.azure.com" target="_blank" rel="noopener noreferrer">
                    Open Azure Portal <ExternalLink className="h-3 w-3 ml-1" />
                  </Link>
                </Button>
              </div>
            )}

            {errorType === "oauth_config" && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm">
                <h4 className="font-semibold text-amber-900 mb-2">OAuth Configuration Error</h4>
                <p className="text-amber-800 mb-2">There's an issue with your OAuth provider configuration.</p>
                <div className="space-y-1 text-amber-700">
                  <p>Check your Supabase Auth settings:</p>
                  <ul className="list-disc list-inside ml-2 space-y-1">
                    <li>Verify redirect URLs match exactly</li>
                    <li>Ensure PKCE is enabled for Azure provider</li>
                    <li>Check client ID and secret are correct</li>
                  </ul>
                </div>
              </div>
            )}

            {errorType !== "email_expired" && (
              <Button asChild className="w-full">
                <Link href="/auth/login">Back to Login</Link>
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-muted/30 to-accent/10 p-4">
      <Card className="w-full max-w-md shadow-lg border-0 bg-card/80 backdrop-blur-sm">
        <CardHeader className="text-center space-y-4">
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="p-2 bg-primary rounded-lg">
              <Leaf className="h-6 w-6 text-primary-foreground" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">GreenLoop</h1>
          </div>
          <div className="mx-auto p-3 bg-green-100 rounded-full w-fit">
            <CheckCircle className="h-8 w-8 text-green-600" />
          </div>
          <CardTitle className="text-xl">Authentication Successful</CardTitle>
          <CardDescription>Redirecting you to the appropriate page...</CardDescription>
        </CardHeader>
      </Card>
    </div>
  )
}
