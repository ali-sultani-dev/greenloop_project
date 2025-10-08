import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import AnalyticsCharts from "@/components/admin/analytics-charts"

export default async function AdminAnalyticsPage() {
  const supabase = await createClient()

  const { data, error } = await supabase.auth.getUser()
  if (error || !data?.user) {
    redirect("/auth/login")
  }

  // Check if user is admin
  const { data: userProfile } = await supabase.from("users").select("*").eq("id", data.user.id).single()

  if (!userProfile?.is_admin) {
    redirect("/dashboard")
  }

  const { data: dashboardStats } = await supabase.from("admin_dashboard_stats").select("*").single()

  const { data: monthlyTrends } = await supabase
    .from("admin_monthly_trends")
    .select("*")
    .order("month", { ascending: true })

  const { data: categoryBreakdown } = await supabase
    .from("admin_category_breakdown")
    .select("*")
    .order("action_count", { ascending: false })

  const { data: topPerformers } = await supabase.rpc("get_top_performers", { p_limit: 10 })

  const monthlyUserGrowth =
    monthlyTrends?.map((trend) => ({
      month: new Date(trend.month).toLocaleDateString("en-US", { month: "short", year: "2-digit" }),
      newUsers: trend.new_users || 0,
    })) || []

  const monthlyActionTrends =
    monthlyTrends?.map((trend) => ({
      month: new Date(trend.month).toLocaleDateString("en-US", { month: "short", year: "2-digit" }),
      actions: trend.actions_completed || 0,
      co2: Math.round((trend.actions_completed || 0) * 2.5), // Estimated CO2 per action
      points: Math.round((trend.actions_completed || 0) * 10), // Estimated points per action
    })) || []

  const realCategoryBreakdown =
    categoryBreakdown?.map((category, index) => ({
      name: category.category_name,
      value: category.action_count || 0,
      co2: Math.round(category.total_co2_impact || 0),
      color: getCategoryColor(category.category_name),
      percent: (category.percentage || 0) / 100,
    })) || []

  function getCategoryColor(category: string) {
    const colors: { [key: string]: string } = {
      Energy: "#4ECDC4", // Turquoise
      Transportation: "#FF6B6B", // Coral Red
      Waste: "#96CEB4", // Mint Green
      Water: "#FFEAA7", // Soft Yellow
      Food: "#F8C471", // Peach
      "Food & Diet": "#BB8FCE", // Lavender
      "Office Practices": "#85C1E9", // Light Blue
      Office: "#85C1E9", // Light Blue
      "Home & Garden": "#82E0AA", // Light Green
      Community: "#F7DC6F", // Light Gold
      Digital: "#45B7D1", // Sky Blue
      Shopping: "#DDA0DD", // Plum
      "Health & Wellness": "#98D8C8", // Seafoam
      "Water Conservation": "#FFEAA7", // Soft Yellow
      "Waste Reduction": "#96CEB4", // Mint Green
      Other: "#9ca3af", // Gray-400
    }
    return colors[category] || colors["Other"]
  }

  return (
    <AnalyticsCharts
      totalUsersCount={dashboardStats?.active_users || 0}
      activeUsersCount={dashboardStats?.active_users_7d || 0}
      totalActionsCount={dashboardStats?.total_verified_actions || 0}
      totalTeamsCount={dashboardStats?.active_teams || 0}
      activeChallengesCount={dashboardStats?.active_challenges || 0}
      totalCO2Saved={dashboardStats?.total_co2_saved || 0}
      totalPointsEarned={dashboardStats?.total_points_awarded || 0}
      monthlyUserGrowth={monthlyUserGrowth}
      monthlyActionTrends={monthlyActionTrends}
      categoryBreakdown={realCategoryBreakdown}
      teamPerformance={topPerformers || []}
    />
  )
}
