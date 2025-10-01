import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { Navigation } from "@/components/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { BarChart3, Trophy, Award, Leaf, Users, Crown, Medal, Target } from "lucide-react"

export default async function LeaderboardPage() {
  const supabase = await createClient()

  const { data, error } = await supabase.auth.getUser()
  if (error || !data?.user) {
    redirect("/auth/login")
  }

  // Get user profile
  const { data: userProfile } = await supabase.from("users").select("*").eq("id", data.user.id).single()

  // Get top users by points
  const { data: topByPoints } = await supabase
    .from("users")
    .select("id, first_name, last_name, department, points, level, total_co2_saved, avatar_url")
    .eq("is_active", true)
    .order("points", { ascending: false })
    .limit(10)

  // Get top users by CO2 saved
  const { data: topByCO2 } = await supabase
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

  const { data: topByActions } = topUserIds.length
    ? await supabase
        .from("users")
        .select("id, first_name, last_name, department, points, level, total_co2_saved, avatar_url")
        .in("id", topUserIds)
    : { data: [] }

  // Sort by action count
  const topByActionsWithCount = topByActions
    ?.map((user) => ({
      ...user,
      action_count: actionCounts?.[user.id] || 0,
    }))
    .sort((a, b) => b.action_count - a.action_count)

  // Get department rankings
  const { data: departmentStats } = await supabase.rpc("get_department_rankings")

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

  const getRankBadgeColor = (rank: number) => {
    switch (rank) {
      case 1:
        return "bg-yellow-100 text-yellow-800"
      case 2:
        return "bg-gray-100 text-gray-800"
      case 3:
        return "bg-amber-100 text-amber-800"
      default:
        return "bg-muted text-muted-foreground"
    }
  }

  const findUserRank = (users: any[], userId: string) => {
    const index = users?.findIndex((user) => user.id === userId)
    return index !== -1 ? index + 1 : null
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation user={userProfile} />

      <main className="container mx-auto px-4 py-8">
        <div className="space-y-8">
          {/* Header */}
          <div className="space-y-2">
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
              <BarChart3 className="h-8 w-8 text-primary" />
              Leaderboard
            </h1>
            <p className="text-muted-foreground text-balance">
              See how you rank against your colleagues in sustainability efforts. Compete, collaborate, and celebrate
              environmental achievements together.
            </p>
          </div>

          {/* User's Current Ranking */}
          <Card className="bg-gradient-to-r from-primary/5 to-accent/5 border-primary/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="h-5 w-5 text-primary" />
                Your Current Ranking
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-primary">
                    #{findUserRank(topByPoints || [], userProfile?.id || "") || "N/A"}
                  </div>
                  <p className="text-sm text-muted-foreground">Points Ranking</p>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-accent">
                    #{findUserRank(topByCO2 || [], userProfile?.id || "") || "N/A"}
                  </div>
                  <p className="text-sm text-muted-foreground">CO₂ Saved Ranking</p>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    #{findUserRank(topByActionsWithCount || [], userProfile?.id || "") || "N/A"}
                  </div>
                  <p className="text-sm text-muted-foreground">Monthly Actions</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Leaderboard Tabs */}
          <Tabs defaultValue="points" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="points">Points</TabsTrigger>
              <TabsTrigger value="co2">CO₂ Saved</TabsTrigger>
              <TabsTrigger value="actions">Monthly Actions</TabsTrigger>
              <TabsTrigger value="departments">Departments</TabsTrigger>
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
                  <div className="space-y-4">
                    {topByPoints?.map((user, index) => (
                      <div
                        key={user.id}
                        className={`flex items-center gap-4 p-4 rounded-lg ${
                          user.id === userProfile?.id ? "bg-primary/5 border border-primary/20" : "bg-muted/30"
                        }`}
                      >
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
                          <div className="flex items-center gap-2">
                            <h3 className="font-medium">
                              {user.first_name} {user.last_name}
                            </h3>
                            {user.id === userProfile?.id && (
                              <Badge variant="secondary" className="text-xs">
                                You
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">{user.department}</p>
                        </div>

                        <div className="text-right">
                          <div className="text-lg font-bold text-primary">{user.points}</div>
                          <div className="text-xs text-muted-foreground">Level {user.level}</div>
                        </div>
                      </div>
                    ))}
                  </div>
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
                  <div className="space-y-4">
                    {topByCO2?.map((user, index) => (
                      <div
                        key={user.id}
                        className={`flex items-center gap-4 p-4 rounded-lg ${
                          user.id === userProfile?.id ? "bg-accent/5 border border-accent/20" : "bg-muted/30"
                        }`}
                      >
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
                          <div className="flex items-center gap-2">
                            <h3 className="font-medium">
                              {user.first_name} {user.last_name}
                            </h3>
                            {user.id === userProfile?.id && (
                              <Badge variant="secondary" className="text-xs">
                                You
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">{user.department}</p>
                        </div>

                        <div className="text-right">
                          <div className="text-lg font-bold text-accent">{user.total_co2_saved}kg</div>
                          <div className="text-xs text-muted-foreground">CO₂ Saved</div>
                        </div>
                      </div>
                    ))}
                  </div>
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
                  <div className="space-y-4">
                    {topByActionsWithCount?.map((user, index) => (
                      <div
                        key={user.id}
                        className={`flex items-center gap-4 p-4 rounded-lg ${
                          user.id === userProfile?.id ? "bg-blue-50 border border-blue-200" : "bg-muted/30"
                        }`}
                      >
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
                          <div className="flex items-center gap-2">
                            <h3 className="font-medium">
                              {user.first_name} {user.last_name}
                            </h3>
                            {user.id === userProfile?.id && (
                              <Badge variant="secondary" className="text-xs">
                                You
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">{user.department}</p>
                        </div>

                        <div className="text-right">
                          <div className="text-lg font-bold text-blue-600">{user.action_count}</div>
                          <div className="text-xs text-muted-foreground">Actions</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Department Rankings */}
            <TabsContent value="departments" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-purple-600" />
                    Department Rankings
                  </CardTitle>
                  <CardDescription>See which departments are leading in sustainability efforts</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {departmentStats && departmentStats.length > 0 ? (
                      departmentStats.map((dept: any, index: number) => (
                        <div
                          key={dept.department}
                          className={`flex items-center gap-4 p-4 rounded-lg ${
                            dept.department === userProfile?.department
                              ? "bg-purple-50 border border-purple-200"
                              : "bg-muted/30"
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            {getRankIcon(dept.rank_by_points)}
                            <div className="h-10 w-10 rounded-full bg-purple-100 flex items-center justify-center">
                              <Users className="h-5 w-5 text-purple-600" />
                            </div>
                          </div>

                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <h3 className="font-medium">{dept.department}</h3>
                              {dept.department === userProfile?.department && (
                                <Badge variant="secondary" className="text-xs">
                                  Your Dept
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {dept.total_users} member{dept.total_users !== 1 ? "s" : ""}
                            </p>
                          </div>

                          <div className="text-right space-y-1">
                            <div className="text-lg font-bold text-purple-600">{dept.total_points} pts</div>
                            <div className="text-xs text-muted-foreground">
                              {dept.total_co2_saved}kg CO₂ • {dept.total_actions} actions
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>No department data available yet.</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  )
}
