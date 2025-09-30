import { createClient } from "@/lib/supabase/server"
import { type NextRequest, NextResponse } from "next/server"

// Get available users for team membership
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    // Check if current user is team leader or admin
    const { data: userProfile } = await supabase.from("users").select("is_admin").eq("id", user.id).single()

    const { data: team } = await supabase.from("teams").select("team_leader_id").eq("id", params.id).single()

    if (!team) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 })
    }

    const isTeamLeader = team.team_leader_id === user.id
    const isAdmin = userProfile?.is_admin || false

    if (!isTeamLeader && !isAdmin) {
      return NextResponse.json({ error: "Only team leaders and admins can view available users" }, { status: 403 })
    }

    // Get current team members
    const { data: currentMembers } = await supabase.from("team_members").select("user_id").eq("team_id", params.id)

    const currentMemberIds = currentMembers?.map((m) => m.user_id) || []

    let availableUsersQuery = supabase
      .from("users")
      .select("id, first_name, last_name, email, department, job_title")
      .order("first_name")

    // Only add the NOT IN filter if there are current members
    if (currentMemberIds.length > 0) {
      availableUsersQuery = availableUsersQuery.not("id", "in", `(${currentMemberIds.join(",")})`)
    }

    const { data: availableUsers } = await availableUsersQuery

    // Get unique departments
    const departments = [...new Set(availableUsers?.map((u) => u.department).filter(Boolean))]

    return NextResponse.json({
      users: availableUsers || [],
      departments: departments.sort(),
    })
  } catch (error) {
    console.error("Error fetching available users:", error)
    return NextResponse.json({ error: "Failed to fetch available users" }, { status: 500 })
  }
}
