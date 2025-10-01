"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Navigation } from "@/components/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { MonthlyProgressChart } from "@/components/charts/monthly-progress-chart"
import { CategoryPieChart } from "@/components/charts/category-pie-chart"
import { CO2ImpactChart } from "@/components/charts/co2-impact-chart"
import { BarChart3, TrendingUp, Award, Target, Download, Leaf, Zap, Recycle, Loader2 } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import type React from "react"

interface AnalyticsData {
  metrics: {
    totalActions: number
    totalPoints: number
    totalCO2Saved: number
    completedChallenges: number
  }
  actions: any[]
  challenges: any[]
  badges: any[]
  profile: any
  monthlyData: any[]
  categoryData: any[]
  environmentalImpact: { [key: string]: number }
}

export default function AnalyticsPage() {
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [user, setUser] = useState<any>(null)
  const router = useRouter()

  useEffect(() => {
    const fetchData = async () => {
      try {
        const supabase = createClient()

        // Check authentication
        const {
          data: { user: authUser },
          error: authError,
        } = await supabase.auth.getUser()
        if (authError || !authUser) {
          router.push("/auth/login")
          return
        }

        setUser(authUser)

        // Fetch analytics data from API
        const response = await fetch("/api/analytics/user")
        if (!response.ok) {
          throw new Error("Failed to fetch analytics data")
        }

        const data = await response.json()
        setAnalyticsData(data)
      } catch (err) {
        console.error("Error fetching analytics:", err)
        setError(err instanceof Error ? err.message : "Failed to load analytics")
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [router])

  const handleExportReport = async () => {
    if (!analyticsData) return

    try {
      const reportData = {
        user: analyticsData.profile,
        metrics: analyticsData.metrics,
        actions: analyticsData.actions,
        challenges: analyticsData.challenges,
        badges: analyticsData.badges,
        generatedAt: new Date().toISOString(),
      }

      const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: "application/json" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `sustainability-report-${new Date().toISOString().split("T")[0]}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error("Error exporting report:", error)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="flex items-center justify-center min-h-screen">
          <div className="flex items-center gap-2">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span>Loading analytics...</span>
          </div>
        </div>
      </div>
    )
  }

  if (error || !analyticsData) {
    return (
      <div className="min-h-screen bg-background">
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <h2 className="text-xl font-semibold mb-2">Error Loading Analytics</h2>
            <p className="text-muted-foreground">{error || "Failed to load analytics data"}</p>
            <Button onClick={() => window.location.reload()} className="mt-4">
              Try Again
            </Button>
          </div>
        </div>
      </div>
    )
  }

  const { metrics, actions, challenges, badges, profile, monthlyData, categoryData, environmentalImpact } =
    analyticsData

  const activeCategoryData = categoryData?.filter((category: any) => category.value > 0) || []

  const activeEnvironmentalImpact = Object.entries(environmentalImpact || {})
    .filter(([_, value]) => (value as number) > 0)
    .reduce((acc, [key, value]) => ({ ...acc, [key]: value }), {})

  const categoryConfig: {
    [key: string]: { color: string; icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }> }
  } = {
    Energy: { color: "#f59e0b", icon: Zap },
    Transport: { color: "#3b82f6", icon: Target },
    Waste: { color: "#10b981", icon: Recycle },
    Food: { color: "#ef4444", icon: Leaf },
    "Food & Diet": { color: "#dc2626", icon: Award },
    "Office Practices": { color: "#8b5cf6", icon: Zap },
    "Home & Garden": { color: "#059669", icon: Leaf },
    Community: { color: "#f59e0b", icon: Award },
    Digital: { color: "#06b6d4", icon: Zap },
    Shopping: { color: "#ec4899", icon: Recycle },
    "Health & Wellness": { color: "#84cc16", icon: Award },
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation user={profile} />

      <main className="container mx-auto px-4 py-8">
        <div className="space-y-8">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
                <BarChart3 className="h-8 w-8 text-primary" />
                My Analytics
              </h1>
              <p className="text-muted-foreground text-balance">
                Track your sustainability journey, monitor progress, and discover insights about your environmental
                impact.
              </p>
            </div>
            <Button onClick={handleExportReport}>
              <Download className="h-4 w-4 mr-2" />
              Export Report
            </Button>
          </div>

          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Actions</CardTitle>
                <Target className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-primary">{metrics.totalActions}</div>
                <p className="text-xs text-muted-foreground">Sustainability actions completed</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Points Earned</CardTitle>
                <Award className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-accent">{metrics.totalPoints}</div>
                <p className="text-xs text-muted-foreground">Total sustainability points</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">CO₂ Saved</CardTitle>
                <Leaf className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-chart-4">{metrics.totalCO2Saved}kg</div>
                <p className="text-xs text-muted-foreground">Carbon footprint reduced</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Challenges</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-chart-2">{metrics.completedChallenges}</div>
                <p className="text-xs text-muted-foreground">Challenges completed</p>
              </CardContent>
            </Card>
          </div>

          {/* Analytics Tabs */}
          <Tabs defaultValue="overview" className="space-y-6">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="impact">Environmental Impact</TabsTrigger>
              <TabsTrigger value="progress">Progress Tracking</TabsTrigger>
              <TabsTrigger value="achievements">Achievements</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Monthly Progress */}
                <Card>
                  <CardHeader>
                    <CardTitle>Monthly Progress</CardTitle>
                    <CardDescription>Your sustainability activity over time</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <MonthlyProgressChart data={monthlyData} />
                  </CardContent>
                </Card>

                {/* Action Categories */}
                <Card>
                  <CardHeader>
                    <CardTitle>Action Categories</CardTitle>
                    <CardDescription>Distribution of your sustainability actions</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {activeCategoryData.length > 0 ? (
                      <CategoryPieChart data={activeCategoryData} />
                    ) : (
                      <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                        <p>No actions logged yet. Complete some actions to see your categories!</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="impact" className="space-y-6">
              {Object.keys(activeEnvironmentalImpact).length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {Object.entries(activeEnvironmentalImpact).map(([category, co2Value]) => {
                    const config = categoryConfig[category] || { color: "#6b7280", icon: Leaf }
                    const IconComponent = config.icon as React.ComponentType<{
                      className?: string
                      style?: React.CSSProperties
                    }>

                    return (
                      <Card key={category}>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                          <CardTitle className="text-sm font-medium">{category} Saved</CardTitle>
                          <IconComponent className="h-4 w-4" style={{ color: config.color }} />
                        </CardHeader>
                        <CardContent>
                          <div className="text-2xl font-bold">{co2Value as number}kg</div>
                          <p className="text-xs text-muted-foreground">CO₂ from {category.toLowerCase()} actions</p>
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>
              ) : (
                <Card>
                  <CardContent className="flex items-center justify-center h-[200px]">
                    <div className="text-center">
                      <Leaf className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <h3 className="text-lg font-semibold mb-2">No Environmental Impact Yet</h3>
                      <p className="text-muted-foreground">
                        Complete sustainability actions to see your environmental impact!
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* CO2 Impact Over Time */}
              <Card>
                <CardHeader>
                  <CardTitle>CO₂ Impact Over Time</CardTitle>
                  <CardDescription>Your cumulative environmental impact</CardDescription>
                </CardHeader>
                <CardContent>
                  <CO2ImpactChart data={monthlyData} />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="progress" className="space-y-6">
              {/* Recent Actions */}
              <Card>
                <CardHeader>
                  <CardTitle>Recent Actions</CardTitle>
                  <CardDescription>Your latest sustainability activities</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {actions && actions.length > 0 ? (
                      actions.slice(0, 10).map((action) => (
                        <div key={action.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-primary/10 rounded-full">
                              <Leaf className="h-4 w-4 text-primary" />
                            </div>
                            <div>
                              <p className="font-medium text-sm">{action.sustainability_actions?.title}</p>
                              <p className="text-xs text-muted-foreground">
                                {new Date(action.completed_at).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <Badge variant="secondary" className="text-xs">
                              {action.sustainability_actions?.action_categories?.name}
                            </Badge>
                            <p className="text-xs text-muted-foreground mt-1">+{action.points_earned} pts</p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-muted-foreground text-center py-4">No actions logged yet</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="achievements" className="space-y-6">
              {/* Badges */}
              <Card>
                <CardHeader>
                  <CardTitle>Earned Badges</CardTitle>
                  <CardDescription>Recognition for your sustainability achievements</CardDescription>
                </CardHeader>
                <CardContent>
                  {badges && badges.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {badges.map((userBadge) => (
                        <div key={userBadge.id} className="flex items-center gap-3 p-4 bg-muted/50 rounded-lg">
                          <div className="p-3 bg-primary/10 rounded-full">
                            <Award className="h-6 w-6 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium">{userBadge.badges?.name}</p>
                            <p className="text-sm text-muted-foreground">{userBadge.badges?.description}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              Earned {new Date(userBadge.earned_at).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <Award className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <h3 className="text-lg font-semibold mb-2">No Badges Yet</h3>
                      <p className="text-muted-foreground">Complete actions and challenges to earn your first badge!</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  )
}
