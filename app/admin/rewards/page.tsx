"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { createBrowserClient } from "@supabase/ssr"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Gift,
  Clock,
  CheckCircle,
  XCircle,
  Mail,
  User,
  Calendar,
  MessageSquare,
  Plus,
  Edit,
  Trophy,
} from "lucide-react"
import { toast } from "@/hooks/use-toast"
import { RewardCrudModal } from "@/components/admin/reward-crud-modal"

interface RewardClaim {
  id: string
  user_id: string
  level: number
  level_reward_id: string
  claim_status: "pending" | "approved" | "rejected" | "delivered"
  claimed_at: string
  approved_at?: string
  approved_by?: string
  admin_notes?: string
  user_email: string
  user_name: string
  reward_title: string
  reward_description: string
  reward_type: string
}

interface LevelReward {
  id: string
  level: number
  reward_title: string
  reward_description: string
  reward_type: "physical" | "digital" | "experience" | "privilege"
  is_active: boolean
  created_at: string
  updated_at: string
}

interface RewardStats {
  total_claims: number
  pending_claims: number
  approved_claims: number
  rejected_claims: number
  delivered_claims: number
}

export default function AdminRewardsPage() {
  const [claims, setClaims] = useState<RewardClaim[]>([])
  const [rewards, setRewards] = useState<LevelReward[]>([])
  const [stats, setStats] = useState<RewardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState<string | null>(null)
  const [selectedStatus, setSelectedStatus] = useState<string>("all")
  const [showRewardModal, setShowRewardModal] = useState(false)
  const [selectedReward, setSelectedReward] = useState<LevelReward | null>(null)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      // Fetch reward claims
      const { data: claimsData, error: claimsError } = await supabase
        .from("user_level_rewards")
        .select(`
          *,
          level_rewards (
            reward_title,
            reward_description,
            reward_type
          )
        `)
        .order("claimed_at", { ascending: false })

      if (claimsError) throw claimsError

      // Transform claims data
      const transformedClaims =
        claimsData?.map((claim: any) => ({
          ...claim,
          reward_title: claim.level_rewards?.reward_title || "Unknown Reward",
          reward_description: claim.level_rewards?.reward_description || "",
          reward_type: claim.level_rewards?.reward_type || "physical",
        })) || []

      setClaims(transformedClaims)

      // Calculate stats
      const stats = {
        total_claims: transformedClaims.length,
        pending_claims: transformedClaims.filter((c: any) => c.claim_status === "pending").length,
        approved_claims: transformedClaims.filter((c: any) => c.claim_status === "approved").length,
        rejected_claims: transformedClaims.filter((c: any) => c.claim_status === "rejected").length,
        delivered_claims: transformedClaims.filter((c: any) => c.claim_status === "delivered").length,
      }
      setStats(stats)

      // Fetch level rewards
      const { data: rewardsData, error: rewardsError } = await supabase
        .from("level_rewards")
        .select("*")
        .order("level", { ascending: true })
        .order("reward_title", { ascending: true })

      if (rewardsError) throw rewardsError

      setRewards(rewardsData || [])
    } catch (error) {
      console.error("Error fetching data:", error)
      toast({
        title: "Error",
        description: "Failed to load rewards data. Please try again.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const updateClaimStatus = async (
    claimId: string,
    newStatus: "approved" | "rejected" | "delivered",
    adminNotes?: string,
  ) => {
    try {
      setUpdating(claimId)

      let endpoint = ""
      switch (newStatus) {
        case "approved":
          endpoint = "/api/admin/rewards/approve"
          break
        case "rejected":
          endpoint = "/api/admin/rewards/reject"
          break
        case "delivered":
          endpoint = "/api/admin/rewards/deliver"
          break
      }

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          claimId,
          adminNotes: adminNotes || null,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to update claim status")
      }

      toast({
        title: "Status Updated",
        description: `Reward claim has been ${newStatus}.`,
      })

      // Refresh data
      fetchData()
    } catch (error) {
      console.error("Error updating claim status:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update claim status. Please try again.",
        variant: "destructive",
      })
    } finally {
      setUpdating(null)
    }
  }

  const handleCreateReward = () => {
    setSelectedReward(null)
    setShowRewardModal(true)
  }

  const handleEditReward = (reward: LevelReward) => {
    setSelectedReward(reward)
    setShowRewardModal(true)
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
        return <Gift className="h-4 w-4 text-blue-600" />
      default:
        return <Clock className="h-4 w-4 text-gray-600" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-yellow-100 text-yellow-800"
      case "approved":
        return "bg-green-100 text-green-800"
      case "rejected":
        return "bg-red-100 text-red-800"
      case "delivered":
        return "bg-blue-100 text-blue-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const getRewardTypeIcon = (type: string) => {
    switch (type) {
      case "physical":
        return <Gift className="h-4 w-4" />
      case "digital":
        return <Trophy className="h-4 w-4" />
      case "experience":
        return <Calendar className="h-4 w-4" />
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

  const filteredClaims = claims.filter((claim) => {
    if (selectedStatus === "all") return true
    return claim.claim_status === selectedStatus
  })

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="grid gap-6 md:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-24 bg-gray-200 rounded-lg"></div>
            ))}
          </div>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-32 bg-gray-200 rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Reward Management</h1>
        <p className="text-gray-600 mt-2">Manage reward definitions and user reward claims.</p>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-5">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Claims</CardTitle>
              <Gift className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total_claims}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending</CardTitle>
              <Clock className="h-4 w-4 text-yellow-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">{stats.pending_claims}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Approved</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.approved_claims}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Delivered</CardTitle>
              <Gift className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{stats.delivered_claims}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Rejected</CardTitle>
              <XCircle className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{stats.rejected_claims}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tabbed Interface for Reward Management */}
      <Tabs defaultValue="claims" className="space-y-6">
        <TabsList>
          <TabsTrigger value="claims">Reward Claims</TabsTrigger>
          <TabsTrigger value="rewards">Reward Definitions</TabsTrigger>
        </TabsList>

        {/* Claims Management Tab */}
        <TabsContent value="claims" className="space-y-6">
          {/* Filter Tabs */}
          <Tabs value={selectedStatus} onValueChange={setSelectedStatus}>
            <TabsList>
              <TabsTrigger value="all">All Claims</TabsTrigger>
              <TabsTrigger value="pending">Pending</TabsTrigger>
              <TabsTrigger value="approved">Approved</TabsTrigger>
              <TabsTrigger value="delivered">Delivered</TabsTrigger>
              <TabsTrigger value="rejected">Rejected</TabsTrigger>
            </TabsList>

            <TabsContent value={selectedStatus} className="space-y-4">
              {filteredClaims.length === 0 ? (
                <Card className="text-center py-12">
                  <CardContent>
                    <Gift className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">No Claims Found</h3>
                    <p className="text-gray-600">
                      {selectedStatus === "all"
                        ? "No reward claims have been submitted yet."
                        : `No ${selectedStatus} claims found.`}
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-4">
                  {filteredClaims.map((claim) => (
                    <RewardClaimCard
                      key={claim.id}
                      claim={claim}
                      onUpdateStatus={updateClaimStatus}
                      isUpdating={updating === claim.id}
                      getStatusIcon={getStatusIcon}
                      getStatusColor={getStatusColor}
                    />
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </TabsContent>

        {/* Reward Definitions Tab */}
        <TabsContent value="rewards" className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-semibold text-gray-900">Reward Definitions</h2>
              <p className="text-gray-600">Create and manage the rewards available for each level.</p>
            </div>
            <Button onClick={handleCreateReward} className="bg-cyan-600 hover:bg-cyan-700">
              <Plus className="h-4 w-4 mr-2" />
              Create Reward
            </Button>
          </div>

          {rewards.length === 0 ? (
            <Card className="text-center py-12">
              <CardContent>
                <Trophy className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No Rewards Defined</h3>
                <p className="text-gray-600 mb-4">Create reward definitions for different levels to motivate users.</p>
                <Button onClick={handleCreateReward} className="bg-cyan-600 hover:bg-cyan-700">
                  <Plus className="h-4 w-4 mr-2" />
                  Create First Reward
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {rewards.map((reward) => (
                <Card key={reward.id} className="hover:shadow-md transition-shadow">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <CardTitle className="text-lg">{reward.reward_title}</CardTitle>
                          {!reward.is_active && (
                            <Badge variant="outline" className="text-xs text-gray-500">
                              Inactive
                            </Badge>
                          )}
                        </div>
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
                      <Button variant="ghost" size="sm" onClick={() => handleEditReward(reward)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <CardDescription className="text-sm">{reward.reward_description}</CardDescription>
                    <div className="mt-3 text-xs text-gray-500">
                      Created: {new Date(reward.created_at).toLocaleDateString()}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Reward CRUD Modal */}
      <RewardCrudModal
        isOpen={showRewardModal}
        onClose={() => setShowRewardModal(false)}
        reward={selectedReward}
        onSuccess={fetchData}
      />
    </div>
  )
}

interface RewardClaimCardProps {
  claim: RewardClaim
  onUpdateStatus: (claimId: string, status: "approved" | "rejected" | "delivered", notes?: string) => void
  isUpdating: boolean
  getStatusIcon: (status: string) => React.ReactNode
  getStatusColor: (status: string) => string
}

function RewardClaimCard({ claim, onUpdateStatus, isUpdating, getStatusIcon, getStatusColor }: RewardClaimCardProps) {
  const [adminNotes, setAdminNotes] = useState(claim.admin_notes || "")

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <CardTitle className="text-lg">{claim.reward_title}</CardTitle>
              <Badge className={`${getStatusColor(claim.claim_status)} flex items-center gap-1`}>
                {getStatusIcon(claim.claim_status)}
                {claim.claim_status}
              </Badge>
            </div>
            <div className="flex items-center gap-4 text-sm text-gray-600">
              <div className="flex items-center gap-1">
                <User className="h-4 w-4" />
                {claim.user_name}
              </div>
              <div className="flex items-center gap-1">
                <Mail className="h-4 w-4" />
                {claim.user_email}
              </div>
              <div className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                {new Date(claim.claimed_at).toLocaleDateString()}
              </div>
            </div>
          </div>
          <Badge variant="outline">Level {claim.level}</Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <CardDescription>{claim.reward_description}</CardDescription>

        {claim.admin_notes && (
          <div className="bg-gray-50 p-3 rounded-lg">
            <div className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1">
              <MessageSquare className="h-4 w-4" />
              Admin Notes
            </div>
            <p className="text-sm text-gray-600">{claim.admin_notes}</p>
          </div>
        )}

        {claim.claim_status === "pending" && (
          <div className="space-y-3">
            <Textarea
              placeholder="Add admin notes (optional)"
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
              className="min-h-[80px]"
            />
            <div className="flex gap-2">
              <Button
                onClick={() => onUpdateStatus(claim.id, "approved", adminNotes)}
                disabled={isUpdating}
                className="bg-green-600 hover:bg-green-700"
              >
                {isUpdating ? "Updating..." : "Approve"}
              </Button>
              <Button
                onClick={() => onUpdateStatus(claim.id, "rejected", adminNotes)}
                disabled={isUpdating}
                variant="destructive"
              >
                {isUpdating ? "Updating..." : "Reject"}
              </Button>
            </div>
          </div>
        )}

        {claim.claim_status === "approved" && (
          <div className="space-y-3">
            <Textarea
              placeholder="Add delivery notes (optional)"
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
              className="min-h-[80px]"
            />
            <Button
              onClick={() => onUpdateStatus(claim.id, "delivered", adminNotes)}
              disabled={isUpdating}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isUpdating ? "Updating..." : "Mark as Delivered"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
