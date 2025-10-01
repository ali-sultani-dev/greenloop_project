import { createClient } from "@/lib/supabase/server"
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

  try {
    // Get user profile with stats
    const { data: userProfile, error: profileError } = await supabase
      .from("users")
      .select("*")
      .eq("id", user.id)
      .single()

    if (profileError) throw profileError

    // Get user statistics
    const [actionsResult, badgesResult] = await Promise.all([
      supabase
        .from("user_actions")
        .select("id, completed_at")
        .eq("user_id", user.id)
        .eq("verification_status", "approved"),
      supabase.from("user_badges").select("id").eq("user_id", user.id),
    ])

    const stats = {
      totalActions: actionsResult.data?.length || 0,
      totalBadges: badgesResult.data?.length || 0,
      thisWeekActions:
        actionsResult.data?.filter((action) => {
          const actionDate = new Date(action.completed_at)
          const weekAgo = new Date()
          weekAgo.setDate(weekAgo.getDate() - 7)
          return actionDate >= weekAgo
        }).length || 0,
    }

    return NextResponse.json({
      profile: userProfile,
      stats,
    })
  } catch (error) {
    console.error("Error fetching profile:", error)
    return NextResponse.json({ error: "Failed to fetch profile" }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { first_name, last_name, department, job_title, employee_id, avatar_url } = body

    // Validate required fields
    if (!first_name || !last_name || !department || !job_title || !employee_id) {
      return NextResponse.json({ error: "All fields are required" }, { status: 400 })
    }

    // Check if employee_id is unique (excluding current user)
    const { data: existingUser } = await supabase
      .from("users")
      .select("id")
      .eq("employee_id", employee_id)
      .neq("id", user.id)
      .maybeSingle()

    if (existingUser) {
      return NextResponse.json({ error: "Employee ID already exists" }, { status: 400 })
    }

    // Update user profile
    const updateData: any = {
      first_name,
      last_name,
      department,
      job_title,
      employee_id,
      updated_at: new Date().toISOString(),
    }

    // Only update avatar_url if provided
    if (avatar_url !== undefined) {
      updateData.avatar_url = avatar_url
    }

    const { data: updatedProfile, error: updateError } = await supabase
      .from("users")
      .update(updateData)
      .eq("id", user.id)
      .select()
      .single()

    if (updateError) throw updateError

    return NextResponse.json({
      message: "Profile updated successfully",
      profile: updatedProfile,
    })
  } catch (error) {
    console.error("Error updating profile:", error)
    return NextResponse.json({ error: "Failed to update profile" }, { status: 500 })
  }
}
