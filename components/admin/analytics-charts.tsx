"use client"

import { useState, useCallback, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { format } from "date-fns"
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
} from "recharts"
import { BarChart3, Users, TrendingUp, Download, Target, Award, Activity, Crown, Medal, Leaf } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import type { DateRange } from "react-day-picker"

interface AnalyticsChartsProps {
  totalUsersCount: number
  activeUsersCount: number
  totalActionsCount: number
  totalTeamsCount: number
  activeChallengesCount: number
  totalCO2Saved: number
  totalPointsEarned: number
  monthlyUserGrowth: any[]
  monthlyActionTrends: any[]
  categoryBreakdown: any[]
  teamPerformance: any[]
  onDateRangeChange?: (from: Date | undefined, to: Date | undefined) => void
}

export default function AnalyticsCharts({
  totalUsersCount,
  activeUsersCount,
  totalActionsCount,
  totalTeamsCount,
  activeChallengesCount,
  totalCO2Saved,
  totalPointsEarned,
  monthlyUserGrowth,
  monthlyActionTrends,
  categoryBreakdown,
  teamPerformance,
  onDateRangeChange,
}: AnalyticsChartsProps) {
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: new Date(2025, 5, 1), // June 1, 2025
    to: new Date(2025, 8, 7), // September 7, 2025
  })

  const [topByPoints, setTopByPoints] = useState<any[]>([])
  const [topByCO2, setTopByCO2] = useState<any[]>([])
  const [topByActionsWithCount, setTopByActionsWithCount] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchLeaderboardData = async () => {
      const supabase = createClient()

      try {
        // Get top users by points
        const { data: pointsData } = await supabase
          .from("users")
          .select("id, first_name, last_name, department, points, level, total_co2_saved, avatar_url")
          .eq("is_active", true)
          .order("points", { ascending: false })
          .limit(10)

        // Get top users by CO2 saved
        const { data: co2Data } = await supabase
          .from("users")
          .select("id, first_name, last_name, department, points, level, total_co2_saved, avatar_url")
          .eq("is_active", true)
          .order("total_co2_saved", { ascending: false })
          .limit(10)

        // Get top users by actions this month
        const oneMonthAgo = new Date()
        oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1)

        const { data: monthlyActions } = await supabase
          .from("user_actions")
          .select("user_id")
          .eq("verification_status", "approved")
          .gte("completed_at", oneMonthAgo.toISOString())

        // Count actions per user
        const actionCounts = monthlyActions?.reduce(
          (acc, action) => {
            acc[action.user_id] = (acc[action.user_id] || 0) + 1
            return acc
          },
          {} as Record<string, number>,
        )

        // Get user details for top performers this month
        const topUserIds = Object.entries(actionCounts || {})
          .sort(([, a], [, b]) => b - a)
          .slice(0, 10)
          .map(([userId]) => userId)

        const { data: actionsData } = topUserIds.length
          ? await supabase
              .from("users")
              .select("id, first_name, last_name, department, points, level, total_co2_saved, avatar_url")
              .in("id", topUserIds)
          : { data: [] }

        // Sort by action count
        const actionsWithCount = actionsData
          ?.map((user) => ({
            ...user,
            action_count: actionCounts?.[user.id] || 0,
          }))
          .sort((a, b) => b.action_count - a.action_count)

        setTopByPoints(pointsData || [])
        setTopByCO2(co2Data || [])
        setTopByActionsWithCount(actionsWithCount || [])
      } catch (error) {
        console.error("Error fetching leaderboard data:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchLeaderboardData()
  }, [])

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Crown className="h-5 w-5 text-yellow-500" />
      case 2:
        return <Medal className="h-5 w-5 text-gray-400" />
      case 3:
        return <Medal className="h-5 w-5 text-amber-600" />
      default:
        return <span className="text-sm font-bold text-muted-foreground">#{rank}</span>
    }
  }

  const filteredCategoryBreakdown = categoryBreakdown
    .filter((category) => category.value > 0)
    .map((category, index, array) => {
      const percentage = array.length > 0 ? (category.value / array.reduce((sum, cat) => sum + cat.value, 0)) * 100 : 0
      return {
        ...category,
        percentage: Math.round(percentage),
      }
    })
    .filter((category) => category.percentage >= 1) // Only show categories with at least 1%

  const hasValidCategoryData = filteredCategoryBreakdown.length > 0

  const handleDateRangeChange = useCallback(
    (range: DateRange | undefined) => {
      console.log("-> Date range changed:", range)
      setDateRange(range)

      if (range?.from && range?.to && onDateRangeChange) {
        console.log("-> Triggering data fetch for date range:", range.from, "to", range.to)
        onDateRangeChange(range.from, range.to)
      }
    },
    [onDateRangeChange],
  )

  const handleExportReport = () => {
    const reportData = {
      dateRange: {
        from: dateRange?.from?.toISOString(),
        to: dateRange?.to?.toISOString(),
      },
      metrics: {
        totalUsers: totalUsersCount,
        activeUsers: activeUsersCount,
        totalActions: totalActionsCount,
        totalTeams: totalTeamsCount,
        activeChallenges: activeChallengesCount,
        totalCO2Saved: totalCO2Saved,
        totalPointsEarned: totalPointsEarned,
      },
      categoryBreakdown,
      topPerformers: teamPerformance,
    }

    const csvContent = [
      ["Metric", "Value"],
      ["Total Users", totalUsersCount],
      ["Active Users", activeUsersCount],
      ["Total Actions", totalActionsCount],
      ["Total Teams", totalTeamsCount],
      ["Active Challenges", activeChallengesCount],
      ["Total CO2 Saved (kg)", Math.round(totalCO2Saved)],
      ["Total Points Earned", Math.round(totalPointsEarned)],
      [""],
      ["Category Breakdown", ""],
      ...categoryBreakdown.map((cat) => [cat.name, `${cat.value} actions, ${Math.round(cat.co2)}kg CO2`]),
    ]
      .map((row) => row.join(","))
      .join("\n")

    const blob = new Blob([csvContent], { type: "text/csv" })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `analytics-report-${format(new Date(), "yyyy-MM-dd")}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  const formattedMonthlyUserGrowth = monthlyUserGrowth.map((item) => ({
    ...item,
    month: item.month.replace(/(\w+)\s*(\d{2})$/, "$1 20$2"),
  }))

  const formattedMonthlyActionTrends = monthlyActionTrends.map((item) => ({
    ...item,
    month: item.month.replace(/(\w+)\s*(\d{2})$/, "$1 20$2"),
  }))

  return (
    <main className="flex-1 p-8">
      <div className="space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
              <BarChart3 className="h-8 w-8 text-primary" />
              Analytics & Reports
            </h1>
            <p className="text-muted-foreground">
              Comprehensive insights into platform performance, user engagement, and environmental impact.
            </p>
          </div>
          <div className="flex gap-3">
            <Button onClick={handleExportReport}>
              <Download className="h-4 w-4 mr-2" />
              Export Report
            </Button>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Users</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalUsersCount || 0}</div>
              <p className="text-xs text-muted-foreground">Registered platform members</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Actions</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalActionsCount || 0}</div>
              <p className="text-xs text-muted-foreground">Verified sustainability actions</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">CO₂ Saved</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{Math.round(totalCO2Saved)}kg</div>
              <p className="text-xs text-muted-foreground">Total environmental impact</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Teams</CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalTeamsCount || 0}</div>
              <p className="text-xs text-muted-foreground">Collaborative teams</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Points Earned</CardTitle>
              <Award className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{Math.round(totalPointsEarned)}</div>
              <p className="text-xs text-muted-foreground">Total platform points</p>
            </CardContent>
          </Card>
        </div>

        {/* Analytics Tabs */}
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="users">User Analytics</TabsTrigger>
            <TabsTrigger value="engagement">Engagement</TabsTrigger>
            <TabsTrigger value="impact">Environmental Impact</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* User Growth */}
              <Card>
                <CardHeader>
                  <CardTitle>User Growth</CardTitle>
                  <CardDescription>New user registrations over time</CardDescription>
                </CardHeader>
                <CardContent>
                  {formattedMonthlyUserGrowth.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <AreaChart data={formattedMonthlyUserGrowth}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="month" />
                        <YAxis />
                        <Tooltip />
                        <Area type="monotone" dataKey="newUsers" stroke="#0891b2" fill="#0891b2" fillOpacity={0.6} />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                      No user growth data available yet
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Action Categories */}
              <Card>
                <CardHeader>
                  <CardTitle>Action Categories</CardTitle>
                  <CardDescription>Distribution of sustainability actions</CardDescription>
                </CardHeader>
                <CardContent>
                  {hasValidCategoryData ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={filteredCategoryBreakdown}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percentage }) => {
                            return percentage >= 5 ? `${name} ${percentage}%` : ""
                          }}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {filteredCategoryBreakdown.map((entry, index) => {
                            const enhancedColors = [
                              "#FF6B6B", // Coral Red
                              "#4ECDC4", // Turquoise
                              "#45B7D1", // Sky Blue
                              "#96CEB4", // Mint Green
                              "#FFEAA7", // Soft Yellow
                              "#DDA0DD", // Plum
                              "#98D8C8", // Seafoam
                              "#F7DC6F", // Light Gold
                              "#BB8FCE", // Lavender
                              "#85C1E9", // Light Blue
                              "#F8C471", // Peach
                              "#82E0AA", // Light Green
                            ]
                            return (
                              <Cell
                                key={`cell-${index}`}
                                fill={entry.color || enhancedColors[index % enhancedColors.length]}
                              />
                            )
                          })}
                        </Pie>
                        <Tooltip formatter={(value, name) => [`${value} actions`, name]} />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                      No action category data available yet
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Monthly Trends */}
            <Card>
              <CardHeader>
                <CardTitle>Monthly Activity Trends</CardTitle>
                <CardDescription>Actions, points, and CO₂ impact over time</CardDescription>
              </CardHeader>
              <CardContent>
                {formattedMonthlyActionTrends.length > 0 ? (
                  <ResponsiveContainer width="100%" height={400}>
                    <LineChart data={formattedMonthlyActionTrends}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Tooltip />
                      <Line type="monotone" dataKey="actions" stroke="#0891b2" strokeWidth={2} name="Actions" />
                      <Line type="monotone" dataKey="points" stroke="#d97706" strokeWidth={2} name="Points" />
                      <Line type="monotone" dataKey="co2" stroke="#34d399" strokeWidth={2} name="CO₂ Saved (kg)" />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[400px] text-muted-foreground">
                    No monthly activity data available yet
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="users" className="space-y-6">
            <Tabs defaultValue="points" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="points">Points</TabsTrigger>
                <TabsTrigger value="co2">CO₂ Saved</TabsTrigger>
                <TabsTrigger value="actions">Monthly Actions</TabsTrigger>
              </TabsList>

              {/* Points Leaderboard */}
              <TabsContent value="points" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Award className="h-5 w-5 text-primary" />
                      Top Points Earners
                    </CardTitle>
                    <CardDescription>Users with the highest total sustainability points</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {loading ? (
                      <div className="flex items-center justify-center py-8 text-muted-foreground">
                        <p>Loading user data...</p>
                      </div>
                    ) : topByPoints.length > 0 ? (
                      <div className="space-y-4">
                        {topByPoints.map((user, index) => (
                          <div key={user.id} className="flex items-center gap-4 p-4 rounded-lg bg-muted/30">
                            <div className="flex items-center gap-3">
                              {getRankIcon(index + 1)}
                              <Avatar className="h-10 w-10">
                                <AvatarImage src={user.avatar_url || "/placeholder.svg"} />
                                <AvatarFallback>
                                  {user.first_name?.[0]}
                                  {user.last_name?.[0]}
                                </AvatarFallback>
                              </Avatar>
                            </div>

                            <div className="flex-1">
                              <h3 className="font-medium">
                                {user.first_name} {user.last_name}
                              </h3>
                              <p className="text-sm text-muted-foreground">{user.department}</p>
                            </div>

                            <div className="text-right">
                              <div className="text-lg font-bold text-primary">{user.points}</div>
                              <div className="text-xs text-muted-foreground">Level {user.level}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="flex items-center justify-center py-8 text-muted-foreground">
                        <div className="text-center">
                          <Award className="h-12 w-12 mx-auto mb-4 opacity-50" />
                          <p className="font-medium">No user performance data available</p>
                          <p className="text-sm">Users need to complete actions to appear here</p>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* CO2 Leaderboard */}
              <TabsContent value="co2" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Leaf className="h-5 w-5 text-accent" />
                      Top CO₂ Savers
                    </CardTitle>
                    <CardDescription>Users with the highest environmental impact</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {loading ? (
                      <div className="flex items-center justify-center py-8 text-muted-foreground">
                        <p>Loading user data...</p>
                      </div>
                    ) : topByCO2.length > 0 ? (
                      <div className="space-y-4">
                        {topByCO2.map((user, index) => (
                          <div key={user.id} className="flex items-center gap-4 p-4 rounded-lg bg-muted/30">
                            <div className="flex items-center gap-3">
                              {getRankIcon(index + 1)}
                              <Avatar className="h-10 w-10">
                                <AvatarImage src={user.avatar_url || "/placeholder.svg"} />
                                <AvatarFallback>
                                  {user.first_name?.[0]}
                                  {user.last_name?.[0]}
                                </AvatarFallback>
                              </Avatar>
                            </div>

                            <div className="flex-1">
                              <h3 className="font-medium">
                                {user.first_name} {user.last_name}
                              </h3>
                              <p className="text-sm text-muted-foreground">{user.department}</p>
                            </div>

                            <div className="text-right">
                              <div className="text-lg font-bold text-accent">{user.total_co2_saved}kg</div>
                              <div className="text-xs text-muted-foreground">CO₂ Saved</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="flex items-center justify-center py-8 text-muted-foreground">
                        <div className="text-center">
                          <Leaf className="h-12 w-12 mx-auto mb-4 opacity-50" />
                          <p className="font-medium">No CO₂ data available</p>
                          <p className="text-sm">Users need to complete actions to appear here</p>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Monthly Actions Leaderboard */}
              <TabsContent value="actions" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Target className="h-5 w-5 text-blue-600" />
                      Most Active This Month
                    </CardTitle>
                    <CardDescription>Users with the most completed actions in the last 30 days</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {loading ? (
                      <div className="flex items-center justify-center py-8 text-muted-foreground">
                        <p>Loading user data...</p>
                      </div>
                    ) : topByActionsWithCount.length > 0 ? (
                      <div className="space-y-4">
                        {topByActionsWithCount.map((user, index) => (
                          <div key={user.id} className="flex items-center gap-4 p-4 rounded-lg bg-muted/30">
                            <div className="flex items-center gap-3">
                              {getRankIcon(index + 1)}
                              <Avatar className="h-10 w-10">
                                <AvatarImage src={user.avatar_url || "/placeholder.svg"} />
                                <AvatarFallback>
                                  {user.first_name?.[0]}
                                  {user.last_name?.[0]}
                                </AvatarFallback>
                              </Avatar>
                            </div>

                            <div className="flex-1">
                              <h3 className="font-medium">
                                {user.first_name} {user.last_name}
                              </h3>
                              <p className="text-sm text-muted-foreground">{user.department}</p>
                            </div>

                            <div className="text-right">
                              <div className="text-lg font-bold text-blue-600">{user.action_count}</div>
                              <div className="text-xs text-muted-foreground">Actions</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="flex items-center justify-center py-8 text-muted-foreground">
                        <div className="text-center">
                          <Target className="h-12 w-12 mx-auto mb-4 opacity-50" />
                          <p className="font-medium">No monthly activity data available</p>
                          <p className="text-sm">Users need to complete actions to appear here</p>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </TabsContent>

          <TabsContent value="engagement" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Avg Actions/User */}
              <Card>
                <CardHeader>
                  <CardTitle>Avg Actions/User</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-orange-600">
                    {totalUsersCount && totalActionsCount && totalUsersCount > 0
                      ? Math.round((totalActionsCount / totalUsersCount) * 10) / 10
                      : 0}
                  </div>
                  <p className="text-sm text-muted-foreground">Actions per user</p>
                </CardContent>
              </Card>

              {/* Challenge Participation */}
              <Card>
                <CardHeader>
                  <CardTitle>Challenge Participation</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-green-600">{activeChallengesCount || 0}</div>
                  <p className="text-sm text-muted-foreground">Active challenges</p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="impact" className="space-y-6">
            {/* Environmental Impact Breakdown */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {filteredCategoryBreakdown.length > 0 ? (
                filteredCategoryBreakdown.map((category) => (
                  <Card key={category.name}>
                    <CardHeader>
                      <CardTitle className="text-sm">{category.name}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold" style={{ color: category.color }}>
                        {Math.round(category.co2)}kg
                      </div>
                      <p className="text-xs text-muted-foreground">CO₂ saved</p>
                      <p className="text-xs text-muted-foreground">{category.value} actions</p>
                    </CardContent>
                  </Card>
                ))
              ) : (
                <Card className="col-span-4">
                  <CardContent className="text-center py-8">
                    <div className="text-center">
                      <TrendingUp className="h-12 w-12 mx-auto mb-4 opacity-50 text-muted-foreground" />
                      <p className="font-medium text-muted-foreground">No environmental impact data available</p>
                      <p className="text-sm text-muted-foreground">
                        Complete sustainability actions to see impact metrics
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </main>
  )
}
