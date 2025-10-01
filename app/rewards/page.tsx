"use client"

import { useState, useEffect } from "react"
import { createBrowserClient } from "@supabase/ssr"
import { Navigation } from "@/components/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Gift,
  Trophy,
  Clock,
  CheckCircle,
  Mail,
  Leaf,
  XCircle,
  Truck,
  MessageSquare,
  Calendar,
  User,
} from "lucide-react"
import { toast } from "@/hooks/use-toast"

interface LevelReward {
  level: number
  reward_id: string
  reward_title: string
  reward_description: string
  reward_type: "physical" | "digital" | "experience" | "privilege"
  already_claimed: boolean
}

interface ClaimedRewardDetail {
  id: string
  level: number
  reward_title: string
  reward_description: string
  reward_type: string
  claim_status: "pending" | "approved" | "rejected" | "delivered"
  claimed_at: string
  approved_at?: string
  admin_notes?: string
  user_email: string
  user_name: string
}

interface UserStats {
  total_points: number
  current_level: number
  next_level_points: number
  points_to_next_level: number
}

interface UserProfile {
  id: string
  email: string
  first_name: string
  last_name: string
  avatar_url?: string
  points: number
  level: number
  is_admin?: boolean
}

interface LevelThreshold {
  level: number
  points_required: number
}

export default function RewardsPage() {
  const [rewards, setRewards] = useState<LevelReward[]>([])
  const [claimedRewardDetails, setClaimedRewardDetails] = useState<ClaimedRewardDetail[]>([])
  const [userStats, setUserStats] = useState<UserStats | null>(null)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [levelThresholds, setLevelThresholds] = useState<LevelThreshold[]>([])
  const [loading, setLoading] = useState(true)
  const [claiming, setClaiming] = useState<string | null>(null)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )

  useEffect(() => {
    fetchRewardsAndStats()
  }, [])

  const fetchRewardsAndStats = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return

      const { data: thresholds, error: thresholdsError } = await supabase
        .from("level_thresholds")
        .select("level, points_required")
        .order("level", { ascending: true })

      if (thresholdsError) {
        console.error("Error fetching level thresholds:", thresholdsError)
        // Fallback to hardcoded thresholds if database query fails
        setLevelThresholds([
          { level: 1, points_required: 0 },
          { level: 2, points_required: 100 },
          { level: 3, points_required: 250 },
          { level: 4, points_required: 500 },
          { level: 5, points_required: 1000 },
          { level: 6, points_required: 2000 },
          { level: 7, points_required: 5000 },
          { level: 8, points_required: 10000 },
          { level: 9, points_required: 20000 },
          { level: 10, points_required: 50000 },
        ])
      } else {
        setLevelThresholds(thresholds || [])
      }

      const { data: profile } = await supabase.from("users").select("*").eq("id", user.id).single()

      const { data: rewardsData, error: rewardsError } = await supabase.rpc("get_user_available_rewards", {
        user_uuid: user.id,
      })

      if (rewardsError) throw rewardsError

      const { data: claimedRewardsData, error: claimedError } = await supabase
        .from("user_level_rewards")
        .select(`
          id,
          level,
          claim_status,
          claimed_at,
          approved_at,
          admin_notes,
          user_email,
          user_name,
          level_rewards (
            reward_title,
            reward_description,
            reward_type
          )
        `)
        .eq("user_id", user.id)
        .order("claimed_at", { ascending: false })

      if (claimedError) throw claimedError

      const transformedClaimedRewards =
        claimedRewardsData?.map((claim: any) => ({
          ...claim,
          reward_title: claim.level_rewards?.reward_title || "Unknown Reward",
          reward_description: claim.level_rewards?.reward_description || "",
          reward_type: claim.level_rewards?.reward_type || "physical",
        })) || []

      const { data: pointsData, error: pointsError } = await supabase
        .from("point_transactions")
        .select("points")
        .eq("user_id", user.id)

      if (pointsError) throw pointsError

      const totalPoints = pointsData?.reduce((sum, transaction) => sum + transaction.points, 0) || 0

      const calculateLevelFromPoints = (points: number, thresholds: LevelThreshold[]) => {
        let currentLevel = 1
        for (let i = thresholds.length - 1; i >= 0; i--) {
          if (points >= thresholds[i].points_required) {
            currentLevel = thresholds[i].level
            break
          }
        }
        return currentLevel
      }

      const currentLevel = calculateLevelFromPoints(totalPoints, thresholds || [])
      const nextThreshold = (thresholds || []).find((t) => t.level === currentLevel + 1)
      const nextLevelPoints = nextThreshold?.points_required || totalPoints
      const pointsToNextLevel = Math.max(0, nextLevelPoints - totalPoints)

      setRewards(rewardsData || [])
      setClaimedRewardDetails(transformedClaimedRewards)
      setUserStats({
        total_points: totalPoints,
        current_level: currentLevel,
        next_level_points: nextLevelPoints,
        points_to_next_level: pointsToNextLevel,
      })

      const updatedProfile = {
        id: user.id,
        email: profile?.email || user.email || "",
        first_name: profile?.first_name || "",
        last_name: profile?.last_name || "",
        avatar_url: profile?.avatar_url,
        points: totalPoints,
        level: currentLevel,
        is_admin: profile?.is_admin || false,
      }

      console.log("Setting user profile with calculated data:", updatedProfile)
      setUserProfile(updatedProfile)
    } catch (error) {
      console.error("Error fetching rewards:", error)
      toast({
        title: "Error",
        description: "Failed to load rewards. Please try again.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const claimReward = async (rewardId: string, level: number, rewardTitle: string) => {
    try {
      setClaiming(rewardId)

      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase
        .from("user_profiles")
        .select("email, first_name, last_name")
        .eq("user_id", user.id)
        .single()

      const userEmail = profile?.email || user.email || ""
      const userName = profile ? `${profile.first_name} ${profile.last_name}`.trim() : "User"

      const { error } = await supabase.from("user_level_rewards").insert({
        user_id: user.id,
        level: level,
        level_reward_id: rewardId,
        user_email: userEmail,
        user_name: userName,
        claim_status: "pending",
      })

      if (error) throw error

      toast({
        title: "Reward Claimed!",
        description: `Your claim for "${rewardTitle}" has been submitted. You'll receive an email from our admin team within 24-48 hours.`,
      })

      fetchRewardsAndStats()
    } catch (error) {
      console.error("Error claiming reward:", error)
      toast({
        title: "Error",
        description: "Failed to claim reward. Please try again.",
        variant: "destructive",
      })
    } finally {
      setClaiming(null)
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "pending":
        return <Clock className="h-4 w-4 text-yellow-600" />
      case "approved":
        return <CheckCircle className="h-4 w-4 text-green-600" />
      case "rejected":
        return <XCircle className="h-4 w-4 text-red-600" />
      case "delivered":
        return <Truck className="h-4 w-4 text-blue-600" />
      default:
        return <Clock className="h-4 w-4 text-gray-600" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-yellow-100 text-yellow-800 border-yellow-200"
      case "approved":
        return "bg-green-100 text-green-800 border-green-200"
      case "rejected":
        return "bg-red-100 text-red-800 border-red-200"
      case "delivered":
        return "bg-blue-100 text-blue-800 border-blue-200"
      default:
        return "bg-gray-100 text-gray-800 border-gray-200"
    }
  }

  const getStatusDescription = (status: string) => {
    switch (status) {
      case "pending":
        return "Your reward claim is being reviewed by our admin team."
      case "approved":
        return "Your reward has been approved and is being prepared for delivery."
      case "rejected":
        return "Your reward claim was not approved. Check admin notes for details."
      case "delivered":
        return "Your reward has been delivered! Enjoy your sustainability achievement."
      default:
        return "Status unknown"
    }
  }

  const getRewardTypeIcon = (type: string) => {
    switch (type) {
      case "physical":
        return <Gift className="h-4 w-4" />
      case "digital":
        return <Trophy className="h-4 w-4" />
      case "experience":
        return <Leaf className="h-4 w-4" />
      case "privilege":
        return <CheckCircle className="h-4 w-4" />
      default:
        return <Gift className="h-4 w-4" />
    }
  }

  const getRewardTypeColor = (type: string) => {
    switch (type) {
      case "physical":
        return "bg-blue-100 text-blue-800"
      case "digital":
        return "bg-purple-100 text-purple-800"
      case "experience":
        return "bg-green-100 text-green-800"
      case "privilege":
        return "bg-orange-100 text-orange-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation user={userProfile || undefined} />
        <div className="container mx-auto px-4 py-8">
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-gray-200 rounded w-1/4"></div>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-48 bg-gray-200 rounded-lg"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  const availableRewards = rewards.filter((r) => !r.already_claimed)
  const claimedRewards = rewards.filter((r) => r.already_claimed)

  return (
    <div className="min-h-screen bg-background">
      <Navigation user={userProfile || undefined} />

      <div className="container mx-auto px-4 py-8 space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-gray-900">Level Rewards</h1>
          <p className="text-gray-600 max-w-2xl mx-auto">
            Complete levels by earning points through sustainability actions and unlock amazing rewards!
          </p>
        </div>

        {userStats && (
          <Card className="bg-gradient-to-r from-cyan-50 to-blue-50 border-cyan-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-cyan-800">
                <Trophy className="h-5 w-5" />
                Your Progress
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold text-cyan-900">{userStats.total_points} Points</p>
                  <p className="text-cyan-700">Level {userStats.current_level}</p>
                </div>
                {userStats.current_level < 10 && (
                  <div className="text-right">
                    <p className="text-sm text-cyan-600">Next Level</p>
                    <p className="font-semibold text-cyan-800">{userStats.points_to_next_level} points to go</p>
                  </div>
                )}
              </div>

              {userStats.current_level < 10 && levelThresholds.length > 0 && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm text-cyan-600">
                    <span>Level {userStats.current_level}</span>
                    <span>Level {userStats.current_level + 1}</span>
                  </div>
                  <div className="w-full bg-cyan-200 rounded-full h-2">
                    <div
                      className="bg-cyan-600 h-2 rounded-full transition-all duration-300"
                      style={{
                        width: `${(() => {
                          const currentThreshold = levelThresholds.find((t) => t.level === userStats.current_level)
                          const nextThreshold = levelThresholds.find((t) => t.level === userStats.current_level + 1)

                          if (!currentThreshold || !nextThreshold) return 0

                          const progressRange = nextThreshold.points_required - currentThreshold.points_required
                          const currentProgress = Math.max(0, userStats.total_points - currentThreshold.points_required)

                          return progressRange > 0 ? (currentProgress / progressRange) * 100 : 100
                        })()}%`,
                      }}
                    ></div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <Tabs defaultValue="available" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="available">Available Rewards</TabsTrigger>
            <TabsTrigger value="claimed">Claimed Rewards</TabsTrigger>
            <TabsTrigger value="status">Reward Status</TabsTrigger>
          </TabsList>

          <TabsContent value="available" className="space-y-4">
            {availableRewards.length > 0 ? (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {availableRewards.map((reward) => (
                  <Card key={reward.reward_id} className="hover:shadow-lg transition-shadow">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <CardTitle className="text-lg">{reward.reward_title}</CardTitle>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">
                              Level {reward.level}
                            </Badge>
                            <Badge className={`text-xs ${getRewardTypeColor(reward.reward_type)}`}>
                              <span className="flex items-center gap-1">
                                {getRewardTypeIcon(reward.reward_type)}
                                {reward.reward_type}
                              </span>
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <CardDescription className="text-sm">{reward.reward_description}</CardDescription>

                      <Separator />

                      <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                        <div className="flex items-start gap-2 text-sm text-blue-800">
                          <Mail className="h-4 w-4 mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="font-medium">How it works:</p>
                            <p className="text-blue-700 mt-1">
                              Click "Claim Reward" and you'll receive an email from our admin team within 24-48 hours
                              with next steps.
                            </p>
                          </div>
                        </div>
                      </div>

                      <Button
                        onClick={() => claimReward(reward.reward_id, reward.level, reward.reward_title)}
                        disabled={claiming === reward.reward_id}
                        className="w-full bg-cyan-600 hover:bg-cyan-700"
                      >
                        {claiming === reward.reward_id ? (
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 animate-spin" />
                            Claiming...
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <Gift className="h-4 w-4" />
                            Claim Reward
                          </div>
                        )}
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="text-center py-12">
                <CardContent>
                  <Gift className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">No Rewards Available Yet</h3>
                  <p className="text-gray-600 mb-4">
                    Complete more sustainability actions to earn points and unlock level rewards!
                  </p>
                  <Button asChild className="bg-cyan-600 hover:bg-cyan-700">
                    <a href="/actions">Start Earning Points</a>
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="claimed" className="space-y-4">
            {claimedRewards.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {claimedRewards.map((reward) => (
                  <Card key={reward.reward_id} className="opacity-75">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <CardTitle className="text-lg text-gray-600">{reward.reward_title}</CardTitle>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">
                              Level {reward.level}
                            </Badge>
                            <Badge className="text-xs bg-green-100 text-green-800">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Claimed
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <CardDescription className="text-sm text-gray-500">{reward.reward_description}</CardDescription>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="text-center py-12">
                <CardContent>
                  <Gift className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">No Claimed Rewards Yet</h3>
                  <p className="text-gray-600">
                    Once you claim rewards, they'll appear here with their status information.
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="status" className="space-y-4">
            {claimedRewardDetails.length > 0 ? (
              <div className="space-y-4">
                <div className="text-center space-y-2 mb-6">
                  <h2 className="text-2xl font-semibold text-gray-900">Your Reward Claims</h2>
                  <p className="text-gray-600">Track the status of your claimed rewards and view admin notes.</p>
                </div>

                {claimedRewardDetails.map((claim) => (
                  <Card key={claim.id} className="hover:shadow-md transition-shadow">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <CardTitle className="text-lg">{claim.reward_title}</CardTitle>
                            <Badge className={`${getStatusColor(claim.claim_status)} flex items-center gap-1 border`}>
                              {getStatusIcon(claim.claim_status)}
                              {claim.claim_status.charAt(0).toUpperCase() + claim.claim_status.slice(1)}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-4 text-sm text-gray-600">
                            <div className="flex items-center gap-1">
                              <User className="h-4 w-4" />
                              Level {claim.level}
                            </div>
                            <div className="flex items-center gap-1">
                              <Calendar className="h-4 w-4" />
                              Claimed {new Date(claim.claimed_at).toLocaleDateString()}
                            </div>
                            {claim.approved_at && (
                              <div className="flex items-center gap-1">
                                <CheckCircle className="h-4 w-4" />
                                Reviewed {new Date(claim.approved_at).toLocaleDateString()}
                              </div>
                            )}
                          </div>
                        </div>
                        <Badge variant="outline" className={getRewardTypeColor(claim.reward_type)}>
                          <span className="flex items-center gap-1">
                            {getRewardTypeIcon(claim.reward_type)}
                            {claim.reward_type}
                          </span>
                        </Badge>
                      </div>
                    </CardHeader>

                    <CardContent className="space-y-4">
                      <CardDescription>{claim.reward_description}</CardDescription>

                      <div
                        className={`p-4 rounded-lg border ${getStatusColor(claim.claim_status).replace("text-", "border-").replace("bg-", "bg-")}`}
                      >
                        <div className="flex items-start gap-3">
                          <div className="flex-shrink-0 mt-0.5">{getStatusIcon(claim.claim_status)}</div>
                          <div>
                            <h4 className="font-semibold text-sm mb-1">
                              Status: {claim.claim_status.charAt(0).toUpperCase() + claim.claim_status.slice(1)}
                            </h4>
                            <p className="text-sm opacity-90">{getStatusDescription(claim.claim_status)}</p>
                          </div>
                        </div>
                      </div>

                      {claim.admin_notes && (
                        <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                          <div className="flex items-start gap-2">
                            <MessageSquare className="h-4 w-4 text-gray-600 mt-0.5 flex-shrink-0" />
                            <div>
                              <h4 className="font-semibold text-sm text-gray-700 mb-1">Admin Notes</h4>
                              <p className="text-sm text-gray-600">{claim.admin_notes}</p>
                            </div>
                          </div>
                        </div>
                      )}

                      {claim.claim_status === "pending" && (
                        <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                          <div className="flex items-start gap-2 text-sm text-blue-800">
                            <Mail className="h-4 w-4 mt-0.5 flex-shrink-0" />
                            <div>
                              <p className="font-medium">What's next?</p>
                              <p className="text-blue-700 mt-1">
                                Our admin team will review your claim and contact you at{" "}
                                <strong>{claim.user_email}</strong> within 24-48 hours.
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="text-center py-12">
                <CardContent>
                  <Clock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">No Reward Claims Yet</h3>
                  <p className="text-gray-600 mb-4">
                    Once you claim rewards, you'll be able to track their status here.
                  </p>
                  <Button asChild className="bg-cyan-600 hover:bg-cyan-700">
                    <a href="#available">Browse Available Rewards</a>
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
