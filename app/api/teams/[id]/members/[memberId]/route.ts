import { createClient } from "@/lib/supabase/server"
import { type NextRequest, NextResponse } from "next/server"

// Remove member from team
export async function DELETE(request: NextRequest, { params }: { params: { id: string; memberId: string } }) {
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
      return NextResponse.json({ error: "Only team leaders and admins can remove members" }, { status: 403 })
    }

    // Get member details
    const { data: member } = await supabase
      .from("team_members")
      .select("user_id, role")
      .eq("team_id", params.id)
      .eq("user_id", params.memberId)
      .single()

    if (!member) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 })
    }

    // Prevent removing team leader
    if (member.role === "leader") {
      return NextResponse.json({ error: "Cannot remove team leader" }, { status: 400 })
    }

    // Remove member from team
    const { error: deleteError } = await supabase
      .from("team_members")
      .delete()
      .eq("team_id", params.id)
      .eq("user_id", params.memberId)

    if (deleteError) throw deleteError

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error removing team member:", error)
    return NextResponse.json({ error: "Failed to remove team member" }, { status: 500 })
  }
}
