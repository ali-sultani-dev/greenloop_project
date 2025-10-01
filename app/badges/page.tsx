import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { Navigation } from "@/components/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Award, Lock, CheckCircle, Crown, Sparkles, Target } from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { NatureBackground } from "@/components/ui/nature-background"

export default async function BadgesPage() {
  const supabase = await createClient()

  const { data, error } = await supabase.auth.getUser()
  if (error || !data?.user) {
    redirect("/auth/login")
  }

  // Get user profile
  const { data: userProfile } = await supabase.from("users").select("*").eq("id", data.user.id).single()

  // Get all badges
  const { data: allBadges } = await supabase.from("badges").select("*").eq("is_active", true).order("criteria_value")

  // Get user's earned badges
  const { data: userBadges } = await supabase
    .from("user_badges")
    .select("badge_id, earned_at")
    .eq("user_id", data.user.id)

  const earnedBadgeIds = new Set(userBadges?.map((ub) => ub.badge_id) || [])
  const earnedBadgesMap = new Map(userBadges?.map((ub) => [ub.badge_id, ub.earned_at]) || [])

  // Get user's action count for progress calculation
  const { data: userActions } = await supabase
    .from("user_actions")
    .select("id")
    .eq("user_id", data.user.id)
    .eq("verification_status", "approved")

  const actionCount = userActions?.length || 0

  const calculateProgress = (badge: any) => {
    let currentValue = 0

    switch (badge.criteria_type) {
      case "points":
        currentValue = userProfile?.points || 0
        break
      case "actions":
        currentValue = actionCount
        break
      case "co2_saved":
        currentValue = Math.floor(userProfile?.total_co2_saved || 0)
        break
      default:
        currentValue = 0
    }

    return Math.min((currentValue / badge.criteria_value) * 100, 100)
  }

  const getCriteriaText = (badge: any) => {
    switch (badge.criteria_type) {
      case "points":
        return `Earn ${badge.criteria_value} points`
      case "actions":
        return `Complete ${badge.criteria_value} actions`
      case "co2_saved":
        return `Save ${badge.criteria_value}kg of CO₂`
      default:
        return badge.description
    }
  }

  const getCurrentValueText = (badge: any) => {
    switch (badge.criteria_type) {
      case "points":
        return `${userProfile?.points || 0} / ${badge.criteria_value} points`
      case "actions":
        return `${actionCount} / ${badge.criteria_value} actions`
      case "co2_saved":
        return `${Math.floor(userProfile?.total_co2_saved || 0)} / ${badge.criteria_value}kg CO₂`
      default:
        return ""
    }
  }

  const isAdmin = userProfile?.is_admin || false

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 relative">
      <NatureBackground className="fixed inset-0 z-0" />
      <Navigation user={userProfile} />

      <main className="relative z-10 w-full px-4 sm:px-6 lg:px-8 xl:px-12 py-8">
        <div className="space-y-8">
          <div className="space-y-4 animate-organic-slide-up">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="animate-leaf-sway">
                  <div className="p-3 bg-gradient-to-br from-primary to-accent rounded-full leaf-shadow">
                    <Award className="h-8 w-8 text-white" />
                  </div>
                </div>
                <div className="space-y-2">
                  <h1 className="text-4xl font-bold text-foreground text-balance flex items-center gap-3">
                    🏆 Achievement Garden
                  </h1>
                  <p className="text-muted-foreground text-balance text-lg">
                    Cultivate your sustainability journey and watch your achievements bloom! Each badge represents your
                    growing commitment to our planet. 🌱
                  </p>
                </div>
              </div>
              {isAdmin && (
                <Button variant="outline" asChild className="hover-lift leaf-shadow bg-transparent">
                  <Link href="/admin/badges">
                    <Crown className="h-4 w-4 mr-2" />🌿 Tend Badge Garden
                  </Link>
                </Button>
              )}
            </div>
          </div>

          <div
            className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-organic-slide-up"
            style={{ animationDelay: "100ms" }}
          >
            <Card className="organic-card leaf-shadow hover-lift bg-gradient-to-br from-background to-primary/5">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 bg-gradient-to-r from-primary/5 via-primary/3 to-transparent rounded-t-2xl">
                <CardTitle className="text-sm font-medium text-foreground">🌟 Badges Earned</CardTitle>
                <div className="p-2 bg-primary/10 rounded-full animate-nature-pulse">
                  <CheckCircle className="h-4 w-4 text-primary" />
                </div>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="text-3xl font-bold text-primary mb-1">{earnedBadgeIds.size}</div>
                <p className="text-xs text-muted-foreground">out of {allBadges?.length || 0} achievements</p>
              </CardContent>
            </Card>

            <Card className="organic-card leaf-shadow hover-lift bg-gradient-to-br from-background to-accent/5">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 bg-gradient-to-r from-accent/5 via-accent/3 to-transparent rounded-t-2xl">
                <CardTitle className="text-sm font-medium text-foreground">🌱 Growth Progress</CardTitle>
                <div className="p-2 bg-accent/10 rounded-full animate-nature-pulse">
                  <Sparkles className="h-4 w-4 text-accent" />
                </div>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="text-3xl font-bold text-accent mb-2">
                  {allBadges ? Math.round((earnedBadgeIds.size / allBadges.length) * 100) : 0}%
                </div>
                <Progress
                  value={allBadges ? (earnedBadgeIds.size / allBadges.length) * 100 : 0}
                  className="h-2 bg-accent/20"
                />
              </CardContent>
            </Card>

            <Card className="organic-card leaf-shadow hover-lift bg-gradient-to-br from-background to-chart-2/5">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 bg-gradient-to-r from-chart-2/5 via-chart-2/3 to-transparent rounded-t-2xl">
                <CardTitle className="text-sm font-medium text-foreground">🎯 Next Milestone</CardTitle>
                <div className="p-2 bg-chart-2/10 rounded-full animate-nature-pulse">
                  <Target className="h-4 w-4 text-chart-2" />
                </div>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="text-sm font-medium text-foreground mb-1">
                  {allBadges?.find((badge) => !earnedBadgeIds.has(badge.id))?.name || "All unlocked! 🎉"}
                </div>
                <p className="text-xs text-muted-foreground">Keep nurturing your impact</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {allBadges?.map((badge, index) => {
              const isEarned = earnedBadgeIds.has(badge.id)
              const progress = calculateProgress(badge)
              const earnedDate = earnedBadgesMap.get(badge.id)

              return (
                <Card
                  key={badge.id}
                  className={`relative organic-card leaf-shadow hover-lift animate-organic-slide-up ${
                    isEarned
                      ? "bg-gradient-to-br from-background to-primary/10 border-primary/20"
                      : "bg-gradient-to-br from-background to-muted/20 border-muted/20"
                  }`}
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  {isEarned && (
                    <div className="absolute top-3 right-3 z-10">
                      <div className="p-1 bg-primary/10 rounded-full animate-nature-pulse leaf-shadow">
                        <CheckCircle className="h-5 w-5 text-primary" />
                      </div>
                    </div>
                  )}

                  <CardHeader className="text-center pb-4">
                    <div className="mx-auto mb-4">
                      <div
                        className={`w-20 h-20 rounded-2xl flex items-center justify-center transition-all duration-300 leaf-shadow ${
                          isEarned ? "group-hover:scale-110 animate-nature-pulse" : "opacity-60"
                        }`}
                        style={{
                          backgroundColor: isEarned ? badge.badge_color : "#e5e7eb",
                        }}
                      >
                        {isEarned ? (
                          <Award className="h-10 w-10 text-white animate-leaf-sway" />
                        ) : (
                          <Lock className="h-10 w-10 text-gray-500" />
                        )}
                      </div>
                    </div>

                    <CardTitle
                      className={`text-lg text-balance ${!isEarned ? "text-muted-foreground" : "text-foreground"}`}
                    >
                      {badge.name}
                    </CardTitle>

                    <CardDescription className="text-sm text-pretty">{badge.description}</CardDescription>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    <div className="text-center">
                      <Badge
                        variant={isEarned ? "default" : "secondary"}
                        className={`text-xs rounded-full px-3 py-1 leaf-shadow ${
                          isEarned
                            ? "bg-primary/10 text-primary border-primary/20"
                            : "bg-muted/50 text-muted-foreground"
                        }`}
                      >
                        🎯 {getCriteriaText(badge)}
                      </Badge>
                    </div>

                    {!isEarned && (
                      <div className="space-y-3">
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">Growth Progress</span>
                          <span className="font-medium text-primary">{Math.round(progress)}%</span>
                        </div>
                        <Progress value={progress} className="h-2 bg-primary/20" />
                        <p className="text-xs text-muted-foreground text-center bg-primary/5 px-3 py-2 rounded-xl leaf-shadow">
                          🌱 {getCurrentValueText(badge)}
                        </p>
                      </div>
                    )}

                    {isEarned && earnedDate && (
                      <div className="text-center bg-primary/5 px-3 py-2 rounded-xl leaf-shadow">
                        <p className="text-xs text-primary">
                          🌟 Bloomed on {new Date(earnedDate).toLocaleDateString()}
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>
      </main>
    </div>
  )
}
