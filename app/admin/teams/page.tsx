"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { InteractiveSearch } from "@/components/admin/interactive-search"
import { TeamCrudModal } from "@/components/admin/team-crud-modal"
import { ActionDropdown } from "@/components/admin/action-dropdown"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useToast } from "@/hooks/use-toast"
import { Trophy, Plus, Users, Calendar, TrendingUp } from "lucide-react"

interface Team {
  id: string
  name: string
  description: string
  team_leader_id: string
  leader_name: string
  max_members: number
  current_members: number
  total_points: number
  total_co2_saved: number
  is_active: boolean
  created_at: string
}

export default function AdminTeamsPage() {
  const [teams, setTeams] = useState<Team[]>([])
  const [filteredTeams, setFilteredTeams] = useState<Team[]>([])
  const [loading, setLoading] = useState(true)
  const [userProfile, setUserProfile] = useState<any>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null)

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

      const { data: teamsData, error: teamsError } = await supabase
        .from("teams")
        .select(`
          id,
          name,
          description,
          team_leader_id,
          max_members,
          is_active,
          created_at,
          users!teams_team_leader_id_fkey(first_name, last_name)
        `)
        .order("created_at", { ascending: false })

      if (teamsError) {
        console.error("-> Teams error:", teamsError)
        setTeams([])
        setFilteredTeams([])
        return
      }

      const teamsWithStats = await Promise.all(
        (teamsData || []).map(async (team) => {
          // Get team performance data including leader and members
          const { data: performanceData } = await supabase
            .from("team_performance_summary")
            .select("*")
            .eq("team_id", team.id)

          const memberCount = performanceData?.length || 0
          const totalPoints = performanceData?.reduce((sum, member) => sum + (member.points || 0), 0) || 0
          const totalCo2 = performanceData?.reduce((sum, member) => sum + (member.total_co2_saved || 0), 0) || 0

          return {
            id: team.id,
            name: team.name,
            description: team.description,
            team_leader_id: team.team_leader_id,
            leader_name: team.users ? `${(team.users as any).first_name} ${(team.users as any).last_name}` : "Unknown",
            max_members: team.max_members,
            current_members: memberCount,
            total_points: Math.round(totalPoints),
            total_co2_saved: Math.round(totalCo2),
            is_active: team.is_active,
            created_at: team.created_at,
          }
        }),
      )

      console.log("-> Teams with corrected stats:", teamsWithStats)

      setTeams(teamsWithStats)
      setFilteredTeams(teamsWithStats)
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
      ["Team Name", "Leader", "Members", "Total Points", "CO2 Saved", "Status", "Created"].join(","),
      ...filteredTeams.map((team) =>
        [
          `"${team.name}"`,
          `"${team.leader_name}"`,
          `${team.current_members}/${team.max_members}`,
          team.total_points || 0,
          team.total_co2_saved || 0,
          team.is_active ? "Active" : "Inactive",
          team.created_at ? new Date(team.created_at).toLocaleDateString() : "N/A",
        ].join(","),
      ),
    ].join("\n")

    const blob = new Blob([csvContent], { type: "text/csv" })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `teams-export-${new Date().toISOString().split("T")[0]}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  const handleCreateTeam = () => {
    setSelectedTeam(null)
    setModalOpen(true)
  }

  const handleEditTeam = (team: Team) => {
    setSelectedTeam(team)
    setModalOpen(true)
  }

  const handleToggleTeamStatus = async (team: Team) => {
    try {
      const { error } = await supabase.from("teams").update({ is_active: !team.is_active }).eq("id", team.id)

      if (error) throw error

      toast({
        title: "Success",
        description: `Team ${team.is_active ? "deactivated" : "activated"} successfully`,
      })

      loadData()
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update team status",
        variant: "destructive",
      })
    }
  }

  const handleDeleteTeam = async (team: Team) => {
    if (!confirm(`Are you sure you want to delete the team "${team.name}"? This action cannot be undone.`)) {
      return
    }

    try {
      const { error } = await supabase.from("teams").delete().eq("id", team.id)

      if (error) throw error

      toast({
        title: "Success",
        description: "Team deleted successfully",
      })

      loadData()
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete team",
        variant: "destructive",
      })
    }
  }

  const handleManageMembers = (team: Team) => {
    // Navigate to team member management page or open modal
    window.location.href = `/admin/teams/${team.id}/members`
  }

  const filterOptions = [
    {
      key: "is_active",
      label: "Status",
      values: ["true", "false"],
    },
    {
      key: "leader_name",
      label: "Team Leader",
      values: [...new Set(teams.map((t) => t.leader_name).filter(Boolean))].sort(),
    },
  ]

  if (loading) {
    return (
      <main className="flex-1 p-8">
        <div className="text-center">Loading...</div>
      </main>
    )
  }

  return (
    <main className="flex-1 p-8">
      <div className="space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
              <Trophy className="h-8 w-8 text-primary" />
              Team Management
            </h1>
            <p className="text-muted-foreground">
              Manage teams, monitor collaboration, and track team performance across the platform.
            </p>
          </div>
          <Button onClick={handleCreateTeam}>
            <Plus className="h-4 w-4 mr-2" />
            Create Team
          </Button>
        </div>

        {/* Search and Filters */}
        <Card>
          <CardHeader>
            <CardTitle>Search Teams</CardTitle>
            <CardDescription>Find and filter teams by name, leader, or performance metrics</CardDescription>
          </CardHeader>
          <CardContent>
            <InteractiveSearch
              data={teams}
              onFilteredData={setFilteredTeams}
              searchFields={["name", "description", "leader_name"]}
              filterOptions={filterOptions}
              placeholder="Search by team name or leader..."
              onExport={handleExport}
            />
          </CardContent>
        </Card>

        {/* Teams Table */}
        <Card>
          <CardHeader>
            <CardTitle>All Teams ({filteredTeams.length})</CardTitle>
            <CardDescription>Complete list of teams with their performance and engagement metrics</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Team</TableHead>
                  <TableHead>Leader</TableHead>
                  <TableHead>Members</TableHead>
                  <TableHead>Performance</TableHead>
                  <TableHead>CO₂ Impact</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="w-[50px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTeams.map((team) => (
                  <TableRow key={team.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{team.name}</p>
                        <p className="text-sm text-muted-foreground">{team.description}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="text-xs">
                            {team.leader_name
                              ?.split(" ")
                              .map((n) => n[0])
                              .join("")}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm">{team.leader_name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span>
                          {team.current_members} / {team.max_members}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-primary" />
                        <span className="font-medium">{team.total_points || 0} pts</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium text-green-600">{team.total_co2_saved || 0}kg</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={team.is_active ? "default" : "secondary"}>
                        {team.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        {team.created_at ? new Date(team.created_at).toLocaleDateString() : "N/A"}
                      </div>
                    </TableCell>
                    <TableCell>
                      <ActionDropdown
                        type="team"
                        isActive={team.is_active}
                        onEdit={() => handleEditTeam(team)}
                        onDelete={() => handleDeleteTeam(team)}
                        onToggleStatus={() => handleToggleTeamStatus(team)}
                        onManageMembers={() => handleManageMembers(team)}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <TeamCrudModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        team={selectedTeam}
        onSuccess={loadData}
        currentAdminId={userProfile?.id}
      />
    </main>
  )
}
