import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { Navigation } from "@/components/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { MotivationalQuote } from "@/components/ui/motivational-quote"
import { NatureBackground } from "@/components/ui/nature-background"
import { EcoMetricCard } from "@/components/ui/eco-metric-card"
import {
  Leaf,
  Award,
  Calendar,
  Zap,
  Droplets,
  Recycle,
  Car,
  Plus,
  Megaphone,
  Globe,
  GraduationCap,
  BookOpen,
} from "lucide-react"
import Link from "next/link"

export default async function DashboardPage() {
  const supabase = await createClient()

  const { data, error } = await supabase.auth.getUser()
  if (error || !data?.user) {
    redirect("/auth/login")
  }

  // Get user profile data
  const { data: userProfile } = await supabase.from("users").select("*").eq("id", data.user.id).single()

  const { data: levelThresholds } = await supabase
    .from("level_thresholds")
    .select("level, points_required")
    .order("level", { ascending: true })

  const calculateLevelProgress = (userPoints: number, userLevel: number) => {
    if (!levelThresholds || levelThresholds.length === 0) {
      // Fallback to old calculation if thresholds not available
      const pointsToNextLevel = (userLevel || 1) * 1000 - (userPoints || 0)
      const levelProgress = ((userPoints || 0) % 1000) / 10
      return { pointsToNextLevel, levelProgress }
    }

    const currentThreshold = levelThresholds.find((t) => t.level === userLevel)
    const nextThreshold = levelThresholds.find((t) => t.level === userLevel + 1)

    if (!currentThreshold) {
      return { pointsToNextLevel: 0, levelProgress: 100 }
    }

    if (!nextThreshold) {
      // User is at max level
      return { pointsToNextLevel: 0, levelProgress: 100 }
    }

    const pointsToNextLevel = Math.max(0, nextThreshold.points_required - (userPoints || 0))
    const progressRange = nextThreshold.points_required - currentThreshold.points_required
    const currentProgress = Math.max(0, (userPoints || 0) - currentThreshold.points_required)
    const levelProgress = progressRange > 0 ? (currentProgress / progressRange) * 100 : 100

    return { pointsToNextLevel, levelProgress }
  }

  const { pointsToNextLevel, levelProgress } = calculateLevelProgress(userProfile?.points || 0, userProfile?.level || 1)

  // Get recent actions
  const { data: recentActions } = await supabase
    .from("user_actions")
    .select(`
      *,
      sustainability_actions (
        title,
        points_value,
        co2_impact,
        action_categories (name, icon, color)
      )
    `)
    .eq("user_id", data.user.id)
    .order("completed_at", { ascending: false })
    .limit(5)

  // Get user badges
  const { data: userBadges } = await supabase
    .from("user_badges")
    .select(`
      *,
      badges (name, description, icon_url, badge_color)
    `)
    .eq("user_id", data.user.id)
    .order("earned_at", { ascending: false })
    .limit(3)

  // Get available actions for quick access
  const { data: availableActions } = await supabase
    .from("sustainability_actions")
    .select(`
      *,
      action_categories (name, icon, color)
    `)
    .eq("is_active", true)
    .limit(3)

  const { data: challengeActivities } = await supabase
    .from("recent_challenge_activities")
    .select("*")
    .eq("user_id", data.user.id)
    .order("created_at", { ascending: false })
    .limit(3)

  const { data: recentAnnouncements } = await supabase
    .from("content_items")
    .select("*")
    .eq("type", "announcement")
    .eq("status", "published")
    .order("created_at", { ascending: false })
    .limit(2)

  const { data: recentEducationalContent } = await supabase
    .from("content_items")
    .select("*")
    .eq("type", "educational")
    .eq("status", "published")
    .order("created_at", { ascending: false })
    .limit(2)

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 relative">
      <NatureBackground className="fixed inset-0 z-0" />
      <Navigation user={userProfile} />

      <main className="relative z-10 w-full px-4 sm:px-6 lg:px-8 xl:px-12 py-8">
        <div className="space-y-8">
          <div className="space-y-4 animate-organic-slide-up max-w-4xl">
            <div className="flex items-center gap-3">
              <div className="animate-leaf-sway">
                <div className="p-3 bg-gradient-to-br from-primary to-accent rounded-full leaf-shadow">
                  <Leaf className="h-8 w-8 text-white" />
                </div>
              </div>
              <div>
                <h1 className="text-4xl font-bold text-foreground text-balance">
                  Welcome back, {userProfile?.first_name}! 🌱
                </h1>
                <p className="text-muted-foreground text-balance text-lg">
                  Ready to nurture our planet today? Let's grow your sustainability impact together.
                </p>
              </div>
            </div>
          </div>

          <MotivationalQuote userPoints={userProfile?.points} />

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {recentAnnouncements && recentAnnouncements.length > 0 && (
              <Card className="organic-card leaf-shadow hover-lift animate-organic-slide-up bg-gradient-to-br from-primary/5 via-primary/3 to-transparent border-primary/20">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <div className="p-2 bg-primary/10 rounded-full animate-nature-pulse">
                      <Megaphone className="h-5 w-5 text-primary" />
                    </div>
                    🌍 Latest Announcements
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {recentAnnouncements.map((announcement) => (
                    <div
                      key={announcement.id}
                      className="flex items-start gap-3 p-4 organic-card backdrop-blur-sm hover-lift"
                    >
                      <div className="p-1.5 bg-primary/10 rounded-full flex-shrink-0">
                        <Globe className="h-4 w-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-sm">{announcement.title}</h4>
                        <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{announcement.content}</p>
                        <p className="text-xs text-muted-foreground mt-2">
                          {new Date(announcement.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  ))}
                  <Button variant="outline" size="sm" className="w-full bg-transparent hover-lift leaf-shadow" asChild>
                    <Link href="/announcements">🌿 View All Announcements</Link>
                  </Button>
                </CardContent>
              </Card>
            )}

            {recentEducationalContent && recentEducationalContent.length > 0 && (
              <Card className="organic-card leaf-shadow hover-lift animate-organic-slide-up bg-gradient-to-br from-accent/5 via-accent/3 to-transparent border-accent/20">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <div className="p-2 bg-accent/10 rounded-full animate-nature-pulse">
                      <GraduationCap className="h-5 w-5 text-accent" />
                    </div>
                    📚 Nature's Wisdom
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {recentEducationalContent.map((content) => (
                    <div
                      key={content.id}
                      className="flex items-start gap-3 p-4 organic-card backdrop-blur-sm hover-lift"
                    >
                      <div className="p-1.5 bg-accent/10 rounded-full flex-shrink-0">
                        <BookOpen className="h-4 w-4 text-accent" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-sm">{content.title}</h4>
                        <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{content.content}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <Badge variant="outline" className="text-xs leaf-shadow">
                            {content.category}
                          </Badge>
                          <p className="text-xs text-muted-foreground">
                            {new Date(content.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                  <Button variant="outline" size="sm" className="w-full bg-transparent hover-lift leaf-shadow" asChild>
                    <Link href="/education">🌱 Explore All Content</Link>
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-6">
            <EcoMetricCard
              title="🌟 Total Points"
              value={userProfile?.points || 0}
              icon="award"
              description={pointsToNextLevel > 0 ? `${pointsToNextLevel} to next level` : "Max level reached!"}
              trend="up"
              className="sm:col-span-2"
            />

            <EcoMetricCard
              title="🌍 CO₂ Saved"
              value={userProfile?.total_co2_saved || 0}
              suffix=" kg"
              icon="leaf"
              description="Environmental impact"
              trend="up"
            />

            <EcoMetricCard
              title="⚡ Weekly Actions"
              value={recentActions?.length || 0}
              icon="target"
              description="Keep growing!"
              trend="up"
            />

            <EcoMetricCard
              title="🏆 Badges Earned"
              value={userBadges?.length || 0}
              icon="star"
              description="Achievements unlocked"
              trend="neutral"
            />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
            <Card className="xl:col-span-3 organic-card leaf-shadow hover-lift animate-organic-slide-up">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <div className="p-2 bg-primary/10 rounded-full animate-nature-pulse">
                        <Zap className="h-5 w-5 text-primary" />
                      </div>
                      🚀 Quick Actions
                    </CardTitle>
                    <CardDescription>Log your sustainability actions and earn points</CardDescription>
                  </div>
                  <Button asChild size="sm" className="hover-lift leaf-shadow">
                    <Link href="/actions">
                      <Plus className="h-4 w-4 mr-2" />
                      View All
                    </Link>
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {availableActions?.map((action) => (
                  <div
                    key={action.id}
                    className="flex items-center justify-between p-4 organic-card hover-lift border border-border/50"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-3 bg-primary/10 rounded-lg animate-leaf-sway">
                        {action.action_categories?.icon === "🚲" && <Car className="h-5 w-5 text-primary" />}
                        {action.action_categories?.icon === "⚡" && <Zap className="h-5 w-5 text-primary" />}
                        {action.action_categories?.icon === "♻️" && <Recycle className="h-5 w-5 text-primary" />}
                        {action.action_categories?.icon === "💧" && <Droplets className="h-5 w-5 text-primary" />}
                        {![`"🚲"`, `"⚡"`, `"♻️"`, `"💧"`].includes(action.action_categories?.icon || `"\"`) && (
                          <Leaf className="h-5 w-5 text-primary" />
                        )}
                      </div>
                      <div>
                        <h4 className="font-medium">{action.title}</h4>
                        <p className="text-sm text-muted-foreground">{action.description}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <div className="text-sm font-medium text-primary">+{action.points_value} pts</div>
                        <div className="text-xs text-muted-foreground">{action.co2_impact}kg CO₂</div>
                      </div>
                      <Button size="sm" className="hover-lift leaf-shadow" asChild>
                        <Link href={`/actions/log/${action.id}`}>🌱 Log</Link>
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <div className="xl:col-span-1 space-y-6">
              <Card className="organic-card leaf-shadow hover-lift animate-organic-slide-up">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <div className="p-2 bg-chart-3/10 rounded-full animate-nature-pulse">
                      <Award className="h-5 w-5 text-chart-3" />
                    </div>
                    🏆 Recent Badges
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {userBadges?.length ? (
                    userBadges.map((userBadge) => (
                      <div key={userBadge.id} className="flex items-center gap-3 p-3 organic-card hover-lift">
                        <div
                          className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold animate-nature-pulse"
                          style={{ backgroundColor: userBadge.badges?.badge_color || "#10B981" }}
                        >
                          <Award className="h-6 w-6" />
                        </div>
                        <div>
                          <p className="font-medium text-sm">{userBadge.badges?.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(userBadge.earned_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      🌱 No badges earned yet. Complete actions to unlock achievements!
                    </p>
                  )}
                  <Button variant="outline" size="sm" className="w-full bg-transparent hover-lift leaf-shadow" asChild>
                    <Link href="/badges">🌟 View All Badges</Link>
                  </Button>
                </CardContent>
              </Card>

              <Card className="organic-card leaf-shadow hover-lift animate-organic-slide-up">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <div className="p-2 bg-chart-2/10 rounded-full animate-nature-pulse">
                      <Calendar className="h-5 w-5 text-chart-2" />
                    </div>
                    📅 Recent Activity
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {challengeActivities?.map((activity) => (
                    <div
                      key={`challenge-${activity.id}`}
                      className="flex items-center justify-between border-l-2 border-primary pl-3 hover-lift"
                    >
                      <div>
                        <p className="font-medium text-sm">🎯 Challenge Progress</p>
                        <p className="text-xs text-muted-foreground">{activity.challenge_title}</p>
                        <p className="text-xs text-primary">{activity.activity_description}</p>
                      </div>
                      <div className="text-right">
                        {activity.activity_type === "milestone_reached" && (
                          <Badge variant="secondary" className="text-xs leaf-shadow">
                            🎯 Milestone
                          </Badge>
                        )}
                        {activity.activity_type === "challenge_completed" && (
                          <Badge variant="default" className="text-xs bg-green-600 leaf-shadow">
                            🏆 Completed
                          </Badge>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(activity.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  ))}

                  {recentActions?.length ? (
                    recentActions.map((action) => (
                      <div key={action.id} className="flex items-center justify-between p-2 hover-lift rounded">
                        <div>
                          <p className="font-medium text-sm">🌿 {action.sustainability_actions?.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(action.completed_at).toLocaleDateString()}
                          </p>
                        </div>
                        <Badge variant="secondary" className="text-xs animate-nature-pulse leaf-shadow">
                          +{action.points_earned} pts
                        </Badge>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      🌱 No recent actions. Start logging your sustainability efforts!
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
