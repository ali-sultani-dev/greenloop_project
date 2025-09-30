"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Crown, Medal, TrendingUp, Award, Leaf, Target } from "lucide-react"

interface LeaderboardUser {
  id: string
  first_name: string
  last_name: string
  department: string
  avatar_url?: string
  points?: number
  level?: number
  total_co2_saved?: number
  action_count?: number
  rank?: number
}

interface LeaderboardSectionProps {
  title?: string
  description?: string
  showTabs?: boolean
  defaultTab?: string
  limit?: number
}

export function LeaderboardSection({
  title = "Top Performing Users",
  description = "Users with highest sustainability impact",
  showTabs = true,
  defaultTab = "points",
  limit = 10,
}: LeaderboardSectionProps) {
  const [topByPoints, setTopByPoints] = useState<LeaderboardUser[]>([])
  const [topByCO2, setTopByCO2] = useState<LeaderboardUser[]>([])
  const [topByActionsWithCount, setTopByActionsWithCount] = useState<LeaderboardUser[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchLeaderboardData()
  }, [limit])

  const fetchLeaderboardData = async () => {
    const supabase = createClient()

    try {
      // Get top users by points
      const { data: pointsData } = await supabase
        .from("users")
        .select("id, first_name, last_name, department, points, level, total_co2_saved, avatar_url")
        .eq("is_active", true)
        .order("points", { ascending: false })
        .limit(limit)

      // Get top users by CO2 saved
      const { data: co2Data } = await supabase
        .from("users")
        .select("id, first_name, last_name, department, points, level, total_co2_saved, avatar_url")
        .eq("is_active", true)
        .order("total_co2_saved", { ascending: false })
        .limit(limit)

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
        .slice(0, limit)
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

  const renderUserList = (
    users: LeaderboardUser[],
    metricKey: keyof LeaderboardUser,
    metricLabel: string,
    icon: React.ReactNode,
  ) => {
    if (loading) {
      return (
        <div className="flex items-center justify-center py-8 text-muted-foreground">
          <p>Loading user data...</p>
        </div>
      )
    }

    if (users.length === 0) {
      return (
        <div className="flex items-center justify-center py-8 text-muted-foreground">
          <div className="text-center">
            {icon}
            <p className="font-medium">No user performance data available</p>
            <p className="text-sm">Users need to complete actions to appear here</p>
          </div>
        </div>
      )
    }

    return (
      <div className="space-y-4">
        {users.map((user, index) => (
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
              <div className="text-lg font-bold text-primary">
                {metricKey === "total_co2_saved" ? `${user[metricKey]}kg` : user[metricKey] || 0}
              </div>
              <div className="text-xs text-muted-foreground">
                {metricKey === "points" && user.level ? `Level ${user.level}` : metricLabel}
              </div>
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (!showTabs) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            {title}
          </CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>
          {renderUserList(topByPoints, "points", "points", <Award className="h-12 w-12 mx-auto mb-4 opacity-50" />)}
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue={defaultTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="points">Points</TabsTrigger>
            <TabsTrigger value="co2">CO₂ Saved</TabsTrigger>
            <TabsTrigger value="actions">Monthly Actions</TabsTrigger>
          </TabsList>

          {/* Points Leaderboard */}
          <TabsContent value="points" className="space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <Award className="h-5 w-5 text-primary" />
              <h3 className="font-medium">Top Points Earners</h3>
            </div>
            {renderUserList(topByPoints, "points", "points", <Award className="h-12 w-12 mx-auto mb-4 opacity-50" />)}
          </TabsContent>

          {/* CO2 Leaderboard */}
          <TabsContent value="co2" className="space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <Leaf className="h-5 w-5 text-accent" />
              <h3 className="font-medium">Top CO₂ Savers</h3>
            </div>
            {renderUserList(
              topByCO2,
              "total_co2_saved",
              "CO₂ Saved",
              <Leaf className="h-12 w-12 mx-auto mb-4 opacity-50" />,
            )}
          </TabsContent>

          {/* Monthly Actions Leaderboard */}
          <TabsContent value="actions" className="space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <Target className="h-5 w-5 text-blue-600" />
              <h3 className="font-medium">Most Active This Month</h3>
            </div>
            {renderUserList(
              topByActionsWithCount,
              "action_count",
              "Actions",
              <Target className="h-12 w-12 mx-auto mb-4 opacity-50" />,
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
