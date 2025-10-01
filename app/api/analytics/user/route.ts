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
    const { data: userProfile } = await supabase
      .from("users")
      .select("points, total_co2_saved, level, first_name, last_name, is_admin")
      .eq("id", user.id)
      .single()

    const { data: userActions } = await supabase
      .from("user_actions")
      .select(`
        *,
        sustainability_actions (
          title,
          co2_impact,
          points_value,
          action_categories (
            name,
            color,
            icon
          )
        )
      `)
      .eq("user_id", user.id)
      .eq("verification_status", "approved")
      .order("completed_at", { ascending: false })

    const { data: challengeParticipations } = await supabase
      .from("challenge_participants")
      .select(`
        *,
        challenges (
          title,
          reward_points
        )
      `)
      .eq("user_id", user.id)

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

    const totalActions = userActions?.length || 0
    const totalPoints = userProfile?.points || 0
    const totalCO2Saved = userProfile?.total_co2_saved || 0
    const completedChallenges = challengeParticipations?.filter((p) => p.completed).length || 0

    const monthlyData =
      userActions?.reduce((acc: any[], action) => {
        const month = new Date(action.completed_at).toLocaleDateString("en-US", { month: "short", year: "numeric" })
        const existing = acc.find((item) => item.month === month)

        if (existing) {
          existing.actions += 1
          existing.points += action.points_earned || 0
          existing.co2 += action.co2_saved || 0
        } else {
          acc.push({
            month,
            actions: 1,
            points: action.points_earned || 0,
            co2: action.co2_saved || 0,
          })
        }
        return acc
      }, []) || []

    const categoryData =
      userActions?.reduce((acc: any[], action) => {
        const categoryName = action.sustainability_actions?.action_categories?.name || "Other"
        const categoryColor = action.sustainability_actions?.action_categories?.color || "#9ca3af"
        const existing = acc.find((item) => item.name === categoryName)

        if (existing) {
          existing.value += 1
          existing.co2 += action.co2_saved || 0
        } else {
          acc.push({
            name: categoryName,
            value: 1,
            co2: action.co2_saved || 0,
            color: categoryColor,
          })
        }
        return acc
      }, []) || []

    const environmentalImpact = categoryData.reduce((acc: any, category) => {
      acc[category.name] = category.co2
      return acc
    }, {})

    return NextResponse.json({
      metrics: {
        totalActions,
        totalPoints,
        totalCO2Saved,
        completedChallenges,
      },
      actions: userActions,
      challenges: challengeParticipations,
      badges: userBadges,
      profile: userProfile,
      monthlyData,
      categoryData,
      environmentalImpact,
    })
  } catch (error) {
    console.error("Error fetching user analytics:", error)
    return NextResponse.json({ error: "Failed to fetch analytics" }, { status: 500 })
  }
}
