import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { type NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Check if user is admin
  const { data: userProfile } = await supabase.from("users").select("is_admin").eq("id", user.id).single()

  if (!userProfile?.is_admin) {
    return NextResponse.json({ error: "Forbidden - Admin access required" }, { status: 403 })
  }

  try {
    const { data: users, error } = await supabase
      .from("users")
      .select(`
        *,
        team_members (
          teams (id, name)
        )
      `)
      .order("created_at", { ascending: false })

    if (error) throw error

    return NextResponse.json({ users })
  } catch (error) {
    console.error("Error fetching users:", error)
    return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Check if user is admin
  const { data: userProfile } = await supabase.from("users").select("is_admin").eq("id", user.id).single()

  if (!userProfile?.is_admin) {
    return NextResponse.json({ error: "Forbidden - Admin access required" }, { status: 403 })
  }

  try {
    const body = await request.json()
    const { email, firstName, lastName, employeeId, jobTitle, department, isAdmin } = body

    console.log("-> Creating user with email:", email, "and employee ID:", employeeId)

    const { data: existingProfileByEmail } = await supabase
      .from("users")
      .select("id, email")
      .eq("email", email)
      .maybeSingle()

    if (existingProfileByEmail) {
      console.log("-> Profile already exists for email:", email)
      return NextResponse.json({ error: "User with this email already exists" }, { status: 400 })
    }

    if (employeeId) {
      const { data: existingProfileByEmployeeId } = await supabase
        .from("users")
        .select("id, employee_id")
        .eq("employee_id", employeeId)
        .maybeSingle()

      if (existingProfileByEmployeeId) {
        console.log("-> Profile already exists for employee ID:", employeeId)
        return NextResponse.json({ error: "User with this employee ID already exists" }, { status: 400 })
      }
    }

    const adminSupabase = createAdminClient()

    console.log("-> Sending invitation to user")
    const { data: inviteData, error: inviteError } = await adminSupabase.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/auth/callback?type=invite`,
      data: {
        first_name: firstName,
        last_name: lastName,
        employee_id: employeeId,
        job_title: jobTitle,
        department,
        is_admin: isAdmin || false,
        invitation: true,
      },
    })

    if (inviteError) {
      console.log("-> Invitation failed:", inviteError)
      throw inviteError
    }

    console.log("-> Invitation sent successfully to:", email)

    return NextResponse.json({
      message: "User invited successfully. They will receive an email to set up their account.",
      invitedEmail: email,
    })
  } catch (error) {
    console.error("Error creating user:", error)
    return NextResponse.json({ error: "Failed to create user" }, { status: 500 })
  }
}
