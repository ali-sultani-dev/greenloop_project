"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { useToast } from "@/hooks/use-toast"
import { BadgeCrudModal } from "@/components/admin/badge-crud-modal"
import { ActionDropdown } from "@/components/admin/action-dropdown"
import { Plus, Search, Award, Users, Calendar, Target } from "lucide-react"
import { DeleteBadgeModal } from "@/components/admin/delete-badge-modal"

interface BadgeData {
  id: string
  name: string
  description: string
  icon_url: string | null
  criteria_type: string
  criteria_value: number
  badge_color: string
  is_active: boolean
  created_at: string
  user_count?: number
}

interface UserBadgeData {
  id: string
  user_id: string
  badge_id: string
  earned_at: string
  user: {
    first_name: string
    last_name: string
    email: string
  }
  badge: {
    name: string
    badge_color: string
  }
}

export default function BadgeManagementPage() {
  const [badges, setBadges] = useState<BadgeData[]>([])
  const [userBadges, setUserBadges] = useState<UserBadgeData[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedBadge, setSelectedBadge] = useState<BadgeData | null>(null)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [badgeToDelete, setBadgeToDelete] = useState<BadgeData | null>(null)

  const { toast } = useToast()
  const supabase = createClient()

  useEffect(() => {
    fetchBadges()
    fetchUserBadges()
  }, [])

  const fetchBadges = async () => {
    try {
      const { data, error } = await supabase
        .from("badges")
        .select(`
          *,
          user_badges(count)
        `)
        .order("created_at", { ascending: false })

      if (error) throw error

      const badgesWithCounts = data.map((badge) => ({
        ...badge,
        user_count: badge.user_badges?.[0]?.count || 0,
      }))

      setBadges(badgesWithCounts)
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to fetch badges",
        variant: "destructive",
      })
    }
  }

  const fetchUserBadges = async () => {
    try {
      const { data, error } = await supabase
        .from("user_badges")
        .select(`
          *,
          user:users(first_name, last_name, email),
          badge:badges(name, badge_color)
        `)
        .order("earned_at", { ascending: false })
        .limit(100)

      if (error) throw error
      setUserBadges(data || [])
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to fetch user badges",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleCreateBadge = () => {
    setSelectedBadge(null)
    setIsModalOpen(true)
  }

  const handleEditBadge = (badge: BadgeData) => {
    setSelectedBadge(badge)
    setIsModalOpen(true)
  }

  const handleDeleteBadge = async (badge: BadgeData) => {
    setBadgeToDelete(badge)
    setDeleteModalOpen(true)
  }

  const handleToggleBadgeStatus = async (badge: BadgeData) => {
    try {
      const { error } = await supabase.from("badges").update({ is_active: !badge.is_active }).eq("id", badge.id)

      if (error) throw error

      toast({
        title: "Success",
        description: `Badge ${badge.is_active ? "deactivated" : "activated"} successfully`,
      })

      fetchBadges()
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update badge status",
        variant: "destructive",
      })
    }
  }

  const handleModalSuccess = () => {
    fetchBadges()
  }

  const filteredBadges = badges.filter(
    (badge) =>
      badge.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      badge.description.toLowerCase().includes(searchTerm.toLowerCase()),
  )

  const getCriteriaLabel = (type: string) => {
    switch (type) {
      case "points":
        return "Points"
      case "actions":
        return "Actions"
      case "co2_saved":
        return "CO2 Saved (kg)"
      default:
        return type
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Badge Management</h1>
          <p className="text-muted-foreground">
            Manage badges that users can earn for their sustainability achievements
          </p>
        </div>
        <Button onClick={handleCreateBadge}>
          <Plus className="mr-2 h-4 w-4" />
          Create Badge
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Badges</CardTitle>
            <Award className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{badges.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Badges</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{badges.filter((b) => b.is_active).length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Earned</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{userBadges.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">This Month</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {userBadges.filter((ub) => new Date(ub.earned_at).getMonth() === new Date().getMonth()).length}
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="badges" className="space-y-4">
        <TabsList>
          <TabsTrigger value="badges">Badge Definitions</TabsTrigger>
          <TabsTrigger value="earned">Earned Badges</TabsTrigger>
        </TabsList>

        <TabsContent value="badges" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Badge Definitions</CardTitle>
              <CardDescription>Manage the badges available for users to earn</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-2 mb-4">
                <Search className="h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search badges..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="max-w-sm"
                />
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Badge</TableHead>
                    <TableHead>Criteria</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Earned By</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="w-[70px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredBadges.map((badge) => (
                    <TableRow key={badge.id}>
                      <TableCell>
                        <div className="flex items-center space-x-3">
                          <div
                            className="w-8 h-8 rounded-full flex items-center justify-center"
                            style={{ backgroundColor: badge.badge_color }}
                          >
                            <Award className="h-4 w-4 text-white" />
                          </div>
                          <div>
                            <div className="font-medium">{badge.name}</div>
                            <div className="text-sm text-muted-foreground">{badge.description}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {badge.criteria_value} {getCriteriaLabel(badge.criteria_type)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={badge.is_active ? "default" : "secondary"}>
                          {badge.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm font-medium">{badge.user_count} users</div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm text-muted-foreground">{formatDate(badge.created_at)}</div>
                      </TableCell>
                      <TableCell>
                        <ActionDropdown
                          type="content"
                          isActive={badge.is_active}
                          onEdit={() => handleEditBadge(badge)}
                          onDelete={() => handleDeleteBadge(badge)}
                          onToggleStatus={() => handleToggleBadgeStatus(badge)}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="earned" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Earned Badges</CardTitle>
              <CardDescription>View badges that have been earned by users</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Badge</TableHead>
                    <TableHead>Earned Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {userBadges.map((userBadge) => (
                    <TableRow key={userBadge.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{`${userBadge.user.first_name} ${userBadge.user.last_name}`}</div>
                          <div className="text-sm text-muted-foreground">{userBadge.user.email}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <div
                            className="w-6 h-6 rounded-full flex items-center justify-center"
                            style={{ backgroundColor: userBadge.badge.badge_color }}
                          >
                            <Award className="h-3 w-3 text-white" />
                          </div>
                          <span className="font-medium">{userBadge.badge.name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm text-muted-foreground">{formatDate(userBadge.earned_at)}</div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <BadgeCrudModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        badge={selectedBadge}
        onSuccess={handleModalSuccess}
      />

      <DeleteBadgeModal
        badge={badgeToDelete}
        open={deleteModalOpen}
        onOpenChange={setDeleteModalOpen}
        onSuccess={fetchBadges}
      />
    </div>
  )
}
