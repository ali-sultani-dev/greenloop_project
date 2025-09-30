import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { DashboardCharts } from "@/components/admin/dashboard-charts"
import { RefreshButton } from "@/components/admin/refresh-button"
import { LeaderboardSection } from "@/components/admin/leaderboard-section"
import { Users, Trophy, Target, Activity, CheckCircle, Calendar, Leaf, Award, ArrowUpRight } from "lucide-react"

interface TopPerformer {
  user_id: string
  full_name: string
  total_co2_saved: number
  verified_actions: number
  points: number
}

export default async function AdminDashboard() {
  const supabase = await createClient()

  const { data: dashboardStats } = await supabase.from("admin_dashboard_stats").select("*").single()

  const { data: monthlyTrends } = await supabase
    .from("admin_monthly_trends")
    .select("*")
    .order("month", { ascending: true })

  const { data: categoryBreakdown } = await supabase
    .from("admin_category_breakdown")
    .select("*")
    .order("action_count", { ascending: false })

  const { data: weeklyActivity } = await supabase
    .from("admin_weekly_activity")
    .select("*")
    .order("day", { ascending: true })

  const { data: recentActivity } = await supabase
    .from("admin_audit_log_view")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(10)

  const { data: topTeams } = await supabase.rpc("get_top_performers", { p_limit: 5 })

  const monthlyData =
    monthlyTrends?.map((trend) => ({
      month: new Date(trend.month).toLocaleDateString("en-US", { month: "short", year: "2-digit" }),
      users: trend.new_users || 0,
      actions: trend.actions_completed || 0,
    })) || []

  const categoryData =
    categoryBreakdown
      ?.filter((category) => (category.action_count || 0) > 0)
      .map((category, index) => ({
        name: category.category_name,
        value: category.action_count || 0, // Use action_count instead of percentage
        color: getCategoryColor(category.category_name),
      })) || []

  const weeklyData =
    weeklyActivity?.map((day) => ({
      day: day.day_name,
      actions: day.actions || 0,
    })) || []

  const userGrowth = dashboardStats?.new_users_30d || 0
  const actionGrowth = dashboardStats?.actions_30d || 0

  const enhancedUserStats = dashboardStats
    ? {
        total_users: dashboardStats.total_users || dashboardStats.active_users || 0,
        active_users: dashboardStats.active_users || 0,
        admin_users: dashboardStats.admin_users || 0,
        avg_points: dashboardStats.avg_points || 0,
        total_co2_saved: Math.round(dashboardStats.total_co2_saved || 0),
      }
    : undefined

  const enhancedChallengeStats = dashboardStats
    ? {
        total_challenges: dashboardStats.active_challenges || 0,
        active_challenges: dashboardStats.active_challenges || 0,
        avg_completion_rate: dashboardStats.completed_challenges
          ? Math.round((dashboardStats.completed_challenges / Math.max(dashboardStats.active_challenges, 1)) * 100)
          : 0,
        completed_challenges: dashboardStats.completed_challenges || 0,
      }
    : undefined

  const enhancedTeamStats = dashboardStats
    ? {
        total_teams: dashboardStats.active_teams || 0,
        active_teams: dashboardStats.active_teams || 0,
        avg_team_size:
          dashboardStats.active_teams > 0 ? Math.round(dashboardStats.active_users / dashboardStats.active_teams) : 0,
        top_performing_teams: topTeams || [],
      }
    : undefined

  function getCategoryColor(category: string) {
    const colors: { [key: string]: string } = {
      Energy: "#4ECDC4", // Turquoise
      Transportation: "#FF6B6B", // Coral Red
      Waste: "#96CEB4", // Mint Green
      "Waste Reduction": "#96CEB4", // Mint Green
      Water: "#F7DC6F", // Light Gold
      "Water Conservation": "#F7DC6F", // Light Gold
      Food: "#F8C471", // Peach
      "Food & Diet": "#F8C471", // Peach
      "Office Practices": "#BB8FCE", // Lavender
      Office: "#BB8FCE", // Lavender
      "Home & Garden": "#82E0AA", // Light Green
      Community: "#FFEAA7", // Soft Yellow
      Digital: "#85C1E9", // Light Blue
      Shopping: "#DDA0DD", // Plum
      "Health & Wellness": "#98D8C8", // Seafoam
      Other: "#9CA3AF", // Gray
    }
    return colors[category] || colors["Other"]
  }

  return (
    <div className="p-8">
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Admin Dashboard</h1>
            <p className="text-muted-foreground">
              Monitor platform performance, manage users, and track sustainability impact.
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-sm text-muted-foreground">Last updated: {new Date().toLocaleTimeString()}</div>
            <RefreshButton />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="relative overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Users</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{enhancedUserStats?.total_users || 0}</div>
              <div className="flex items-center gap-2 mt-2">
                <div className="flex items-center text-xs text-emerald-600">
                  <ArrowUpRight className="h-3 w-3 mr-1" />+{userGrowth} this month
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-1">Registered platform members</p>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Teams</CardTitle>
              <Trophy className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{dashboardStats?.active_teams || 0}</div>
              <p className="text-xs text-muted-foreground mt-2">Teams collaborating on sustainability</p>
              <div className="mt-3">
                <Badge variant="secondary" className="text-xs">
                  <Award className="h-3 w-3 mr-1" />
                  High Engagement
                </Badge>
              </div>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Challenges</CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{dashboardStats?.active_challenges || 0}</div>
              <p className="text-xs text-muted-foreground mt-2">Ongoing sustainability challenges</p>
              <div className="mt-3">
                <Badge variant="outline" className="text-xs">
                  <Calendar className="h-3 w-3 mr-1" />
                  This Month
                </Badge>
              </div>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">CO₂ Impact</CardTitle>
              <Leaf className="h-4 w-4 text-emerald-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-600">{enhancedUserStats?.total_co2_saved}kg</div>
              <div className="flex items-center gap-2 mt-2">
                <div className="flex items-center text-xs text-emerald-600">
                  <ArrowUpRight className="h-3 w-3 mr-1" />+{actionGrowth} actions this month
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-1">Total CO₂ saved by platform</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Platform Analytics</CardTitle>
            <CardDescription>Comprehensive view of user engagement and environmental impact</CardDescription>
          </CardHeader>
          <CardContent>
            <DashboardCharts
              trendData={monthlyData}
              categoryData={categoryData}
              weeklyData={weeklyData}
              userStats={enhancedUserStats}
              challengeStats={enhancedChallengeStats}
              teamStats={enhancedTeamStats}
            />
          </CardContent>
        </Card>

        {/* Recent Activity & Admin Actions */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Recent Admin Activity
              </CardTitle>
              <CardDescription>Latest administrative actions and system changes</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recentActivity?.slice(0, 8).map((activity) => (
                  <div
                    key={activity.id}
                    className="flex items-center justify-between p-3 bg-muted/50 rounded-lg hover:bg-muted/70 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-primary/10 rounded-full">
                        <CheckCircle className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">{activity.admin_name}</p>
                        <p className="text-xs text-muted-foreground">{activity.action}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge variant="secondary" className="text-xs">
                        {activity.resource_type}
                      </Badge>
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(activity.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                )) || <p className="text-muted-foreground text-center py-4">No recent admin activity</p>}
              </div>
            </CardContent>
          </Card>

          {/* Leaderboard Section */}
          <LeaderboardSection showTabs={false} limit={5} />
        </div>
      </div>
    </div>
  )
}
