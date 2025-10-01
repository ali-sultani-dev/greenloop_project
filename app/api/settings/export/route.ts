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
    // Get user profile
    const { data: userProfile } = await supabase.from("users").select("*").eq("id", user.id).single()

    // Get user preferences
    const { data: preferences } = await supabase.from("user_preferences").select("*").eq("user_id", user.id).single()

    // Get user actions
    const { data: userActions } = await supabase
      .from("user_actions")
      .select(`
        *,
        sustainability_actions (
          title,
          category,
          co2_impact,
          points_value
        )
      `)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })

    // Get user badges
    const { data: userBadges } = await supabase
      .from("user_badges")
      .select(`
        *,
        badges (
          name,
          description,
          icon_url
        )
      `)
      .eq("user_id", user.id)
      .order("earned_at", { ascending: false })

    // Get challenge participations
    const { data: challengeParticipations } = await supabase
      .from("challenge_participants")
      .select(`
        *,
        challenges (
          title,
          category,
          points_reward
        )
      `)
      .eq("user_id", user.id)

    // Get team memberships
    const { data: teamMemberships } = await supabase
      .from("team_members")
      .select(`
        *,
        teams (
          name,
          description
        )
      `)
      .eq("user_id", user.id)

    const exportData = {
      exportInfo: {
        exportedAt: new Date().toISOString(),
        exportedBy: user.id,
        dataVersion: "1.0",
      },
      profile: userProfile,
      preferences,
      actions: userActions,
      badges: userBadges,
      challenges: challengeParticipations,
      teams: teamMemberships,
    }

    // Create filename with timestamp
    const timestamp = new Date().toISOString().split("T")[0]
    const filename = `greenloop-data-export-${timestamp}.json`

    return new NextResponse(JSON.stringify(exportData, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    console.error("Error exporting data:", error)
    return NextResponse.json({ error: "Failed to export data" }, { status: 500 })
  }
}
