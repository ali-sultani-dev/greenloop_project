import { createClient } from "@/lib/supabase/server"
import { type NextRequest, NextResponse } from "next/server"
import { NotificationHelpers } from "@/lib/notifications"

// Add member to team
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
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
    const { email } = body

    // Check if current user is team leader or admin
    const { data: userProfile } = await supabase.from("users").select("is_admin").eq("id", user.id).single()

    const { data: team } = await supabase
      .from("teams")
      .select("team_leader_id, max_members, name")
      .eq("id", params.id)
      .single()

    if (!team) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 })
    }

    const isTeamLeader = team.team_leader_id === user.id
    const isAdmin = userProfile?.is_admin || false

    if (!isTeamLeader && !isAdmin) {
      return NextResponse.json({ error: "Only team leaders and admins can add members" }, { status: 403 })
    }

    // Find user by email
    const { data: targetUser } = await supabase
      .from("users")
      .select("id, first_name, last_name, email")
      .eq("email", email)
      .single()

    if (!targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    // Check if user is already a member
    const { data: existingMember } = await supabase
      .from("team_members")
      .select("id")
      .eq("team_id", params.id)
      .eq("user_id", targetUser.id)
      .single()

    if (existingMember) {
      return NextResponse.json({ error: "User is already a team member" }, { status: 400 })
    }

    // Check team capacity
    const { count: currentMembers } = await supabase
      .from("team_members")
      .select("*", { count: "exact" })
      .eq("team_id", params.id)

    if (currentMembers && currentMembers >= team.max_members) {
      return NextResponse.json({ error: "Team is at maximum capacity" }, { status: 400 })
    }

    // Add member to team
    const { data: newMember, error: memberError } = await supabase
      .from("team_members")
      .insert({
        team_id: params.id,
        user_id: targetUser.id,
        role: "member",
      })
      .select()
      .single()

    if (memberError) throw memberError

    try {
      await NotificationHelpers.addedToTeam(targetUser.id, team.name)
    } catch (notificationError) {
      console.error("Failed to send team addition notification:", notificationError)
      // Don't fail the entire request if notification fails
    }

    return NextResponse.json({
      member: {
        ...newMember,
        users: targetUser,
      },
    })
  } catch (error) {
    console.error("Error adding team member:", error)
    return NextResponse.json({ error: "Failed to add team member" }, { status: 500 })
  }
}
