"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { InteractiveSearch } from "@/components/admin/interactive-search"
import { ChallengeCrudModal } from "@/components/admin/challenge-crud-modal"
import { ActionDropdown } from "@/components/admin/action-dropdown"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useToast } from "@/hooks/use-toast"
import { Target, Plus, Calendar, Users, TrendingUp } from "lucide-react"

interface Challenge {
  id: string
  title: string
  description: string
  category: string
  challenge_type: string
  start_date: string
  end_date: string
  target_metric?: string
  target_value?: number
  reward_points?: number
  max_participants?: number
  is_active: boolean
  created_at: string
  total_participants?: number
  completed_count?: number
  avg_progress?: number
  users?: { first_name: string; last_name: string }
}

export default function AdminChallengesPage() {
  const [challenges, setChallenges] = useState<Challenge[]>([])
  const [filteredChallenges, setFilteredChallenges] = useState<Challenge[]>([])
  const [loading, setLoading] = useState(true)
  const [userProfile, setUserProfile] = useState<any>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedChallenge, setSelectedChallenge] = useState<Challenge | null>(null)

  const { toast } = useToast()
  const supabase = createClient()

  const loadData = async () => {
    try {
      // Check authentication
      const { data: authData, error: authError } = await supabase.auth.getUser()
      if (authError || !authData?.user) {
        window.location.href = "/auth/login"
        return
      }

      // Check if user is admin
      const { data: profile } = await supabase.from("users").select("*").eq("id", authData.user.id).single()

      if (!profile?.is_admin) {
        window.location.href = "/dashboard"
        return
      }

      setUserProfile(profile)

      const { data: challengesData } = await supabase
        .from("admin_challenge_stats")
        .select("*")
        .order("start_date", { ascending: false })

      setChallenges(challengesData || [])
      setFilteredChallenges(challengesData || [])
    } catch (error) {
      console.error("Error loading data:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleExport = () => {
    const csvContent = [
      [
        "Title",
        "Category",
        "Type",
        "Participants",
        "Completion Rate",
        "Status",
        "Start Date",
        "End Date",
        "Reward Points",
      ].join(","),
      ...filteredChallenges.map((challenge) => {
        const completionRate = challenge.avg_progress || 0
        const isActive = challenge.is_active && new Date(challenge.end_date) > new Date()

        return [
          `"${challenge.title}"`,
          challenge.category,
          challenge.challenge_type,
          `${challenge.total_participants || 0}${challenge.max_participants ? `/${challenge.max_participants}` : ""}`,
          `${Math.round(completionRate)}%`,
          isActive ? "Active" : "Ended",
          new Date(challenge.start_date).toLocaleDateString(),
          new Date(challenge.end_date).toLocaleDateString(),
          challenge.reward_points || 0,
        ].join(",")
      }),
    ].join("\n")

    const blob = new Blob([csvContent], { type: "text/csv" })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `challenges-export-${new Date().toISOString().split("T")[0]}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  const handleCreateChallenge = () => {
    setSelectedChallenge(null)
    setModalOpen(true)
  }

  const handleEditChallenge = (challenge: Challenge) => {
    setSelectedChallenge(challenge)
    setModalOpen(true)
  }

  const handleToggleChallengeStatus = async (challenge: Challenge) => {
    try {
      const { error } = await supabase
        .from("challenges")
        .update({ is_active: !challenge.is_active })
        .eq("id", challenge.id)

      if (error) throw error

      toast({
        title: "Success",
        description: `Challenge ${challenge.is_active ? "deactivated" : "activated"} successfully`,
      })

      loadData()
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update challenge status",
        variant: "destructive",
      })
    }
  }

  const handleDeleteChallenge = async (challenge: Challenge) => {
    if (!confirm(`Are you sure you want to delete the challenge "${challenge.title}"? This action cannot be undone.`)) {
      return
    }

    try {
      const { error } = await supabase.from("challenges").delete().eq("id", challenge.id)

      if (error) throw error

      toast({
        title: "Success",
        description: "Challenge deleted successfully",
      })

      loadData()
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete challenge",
        variant: "destructive",
      })
    }
  }

  const filterOptions = [
    {
      key: "category",
      label: "Category",
      values: [...new Set(challenges.map((c) => c.category).filter(Boolean))].sort(),
    },
    {
      key: "challenge_type",
      label: "Type",
      values: [...new Set(challenges.map((c) => c.challenge_type).filter(Boolean))].sort(),
    },
    {
      key: "is_active",
      label: "Status",
      values: ["true", "false"],
    },
  ]

  if (loading) {
    return (
      <div className="flex min-h-screen bg-background">
            <main className="flex-1 p-8">
          <div className="text-center">Loading...</div>
        </main>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen bg-background">
      
      <main className="flex-1 p-8">
        <div className="space-y-8">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
                <Target className="h-8 w-8 text-primary" />
                Challenge Management
              </h1>
              <p className="text-muted-foreground">
                Create, monitor, and manage sustainability challenges across the organization.
              </p>
            </div>
            <Button onClick={handleCreateChallenge}>
              <Plus className="h-4 w-4 mr-2" />
              Create Challenge
            </Button>
          </div>

          {/* Search and Filters */}
          <Card>
            <CardHeader>
              <CardTitle>Search Challenges</CardTitle>
              <CardDescription>Find and filter challenges by title, category, or performance metrics</CardDescription>
            </CardHeader>
            <CardContent>
              <InteractiveSearch
                data={challenges}
                onFilteredData={setFilteredChallenges}
                searchFields={["title", "description", "category", "challenge_type"]}
                filterOptions={filterOptions}
                placeholder="Search by challenge title or category..."
                onExport={handleExport}
              />
            </CardContent>
          </Card>

          {/* Challenges Table */}
          <Card>
            <CardHeader>
              <CardTitle>All Challenges ({filteredChallenges.length})</CardTitle>
              <CardDescription>Complete list of challenges with participation and completion metrics</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Challenge</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Participants</TableHead>
                    <TableHead>Progress</TableHead>
                    <TableHead>Reward</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead className="w-[50px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredChallenges.map((challenge) => {
                    const completionRate = challenge.avg_progress || 0
                    const isActive = challenge.is_active && new Date(challenge.end_date) > new Date()

                    return (
                      <TableRow key={challenge.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{challenge.title}</p>
                            <p className="text-sm text-muted-foreground line-clamp-1">{challenge.description}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{challenge.category}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{challenge.challenge_type}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Users className="h-4 w-4 text-muted-foreground" />
                            <span>
                              {challenge.total_participants || 0} / {challenge.max_participants || "∞"}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <Progress value={completionRate} className="h-2" />
                            <p className="text-xs text-muted-foreground">{Math.round(completionRate)}% avg progress</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <TrendingUp className="h-4 w-4 text-primary" />
                            <span className="font-medium">{challenge.reward_points || 0} pts</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={isActive ? "default" : "secondary"}>{isActive ? "Active" : "Ended"}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            <span>
                              {new Date(challenge.start_date).toLocaleDateString()} -{" "}
                              {new Date(challenge.end_date).toLocaleDateString()}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <ActionDropdown
                            type="challenge"
                            isActive={challenge.is_active}
                            onEdit={() => handleEditChallenge(challenge)}
                            onDelete={() => handleDeleteChallenge(challenge)}
                            onToggleStatus={() => handleToggleChallengeStatus(challenge)}
                          />
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </main>

      <ChallengeCrudModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        challenge={selectedChallenge}
        onSuccess={loadData}
        currentAdminId={userProfile?.id}
      />
    </div>
  )
}
