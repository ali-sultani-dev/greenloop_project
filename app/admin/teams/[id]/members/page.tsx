"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Checkbox } from "@/components/ui/checkbox"
import { useToast } from "@/hooks/use-toast"
import { ArrowLeft, Users, Crown, Mail, Calendar, MoreHorizontal, UserMinus, Trash2, UserPlus } from "lucide-react"
import { AddMemberModal } from "@/components/admin/add-member-modal"
import { RemoveMemberModal } from "@/components/admin/remove-member-modal"

interface TeamMember {
  id: string
  full_name: string
  email: string
  total_points: number
  total_co2_saved: number
  verified_actions: number
  joined_at: string
  is_leader: boolean
}

interface Team {
  id: string
  name: string
  description: string
  team_leader_id: string
  max_members: number
  current_members: number
}

export default function ManageMembersPage() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const [team, setTeam] = useState<Team | null>(null)
  const [members, setMembers] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const [openDropdown, setOpenDropdown] = useState<string | null>(null)
  const [dropdownPosition, setDropdownPosition] = useState<{
    top?: number
    bottom?: number
    left?: number
    right?: number
  }>({})
  const [removeModalOpen, setRemoveModalOpen] = useState(false)
  const [memberToRemove, setMemberToRemove] = useState<TeamMember | null>(null)
  const [selectedMembers, setSelectedMembers] = useState<Set<string>>(new Set())
  const [bulkRemoveLoading, setBulkRemoveLoading] = useState(false)
  const supabase = createClient()

  const loadData = async () => {
    try {
      const teamId = params.id as string

      const { data: teamData } = await supabase.from("teams").select("*").eq("id", teamId).single()

      if (!teamData) {
        toast({
          title: "Error",
          description: "Team not found",
          variant: "destructive",
        })
        router.push("/admin/teams")
        return
      }

      setTeam(teamData)

      const { data: performanceData } = await supabase
        .from("team_performance_summary")
        .select("*")
        .eq("team_id", teamId)
        .order("is_leader", { ascending: false })
        .order("points", { ascending: false })

      const formattedMembers: TeamMember[] = (performanceData || []).map((member: any) => ({
        id: member.user_id,
        full_name: `${member.first_name} ${member.last_name}`,
        email: member.email,
        total_points: member.points || 0,
        total_co2_saved: member.total_co2_saved || 0,
        verified_actions: member.verified_actions || 0,
        joined_at: member.joined_at,
        is_leader: member.is_leader,
      }))

      setMembers(formattedMembers)
    } catch (error) {
      console.error("Error loading data:", error)
      toast({
        title: "Error",
        description: "Failed to load team members",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [params.id])

  useEffect(() => {
    const handleClickOutside = () => {
      setOpenDropdown(null)
    }

    if (openDropdown) {
      document.addEventListener("click", handleClickOutside)
      return () => document.removeEventListener("click", handleClickOutside)
    }
  }, [openDropdown])

  const toggleDropdown = (memberId: string, event?: React.MouseEvent) => {
    if (openDropdown === memberId) {
      setOpenDropdown(null)
      return
    }

    if (event) {
      const rect = (event.target as HTMLElement).getBoundingClientRect()
      const viewportWidth = window.innerWidth
      const viewportHeight = window.innerHeight
      const dropdownWidth = 192
      const dropdownHeight = 120

      const position: { top?: number; bottom?: number; left?: number; right?: number } = {}

      if (rect.right + dropdownWidth > viewportWidth) {
        position.right = viewportWidth - rect.left
      } else {
        position.left = rect.right
      }

      if (rect.bottom + dropdownHeight > viewportHeight) {
        position.bottom = viewportHeight - rect.top
      } else {
        position.top = rect.bottom
      }

      setDropdownPosition(position)
    }

    setOpenDropdown(memberId)
  }

  const handleRemoveMember = (member: TeamMember) => {
    setMemberToRemove(member)
    setRemoveModalOpen(true)
    setOpenDropdown(null)
  }

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const selectableMembers = members.filter((member) => !member.is_leader).map((member) => member.id)
      setSelectedMembers(new Set(selectableMembers))
    } else {
      setSelectedMembers(new Set())
    }
  }

  const handleSelectMember = (memberId: string, checked: boolean) => {
    const newSelected = new Set(selectedMembers)
    if (checked) {
      newSelected.add(memberId)
    } else {
      newSelected.delete(memberId)
    }
    setSelectedMembers(newSelected)
  }

  const handleBulkRemove = async () => {
    if (selectedMembers.size === 0) return

    setBulkRemoveLoading(true)
    try {
      const { error } = await supabase
        .from("team_members")
        .delete()
        .eq("team_id", params.id as string)
        .in("user_id", Array.from(selectedMembers))

      if (error) throw error

      toast({
        title: "Success",
        description: `${selectedMembers.size} member(s) have been removed from the team`,
      })

      setSelectedMembers(new Set())
      loadData()
    } catch (error: any) {
      console.error("Bulk remove error:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to remove members",
        variant: "destructive",
      })
    } finally {
      setBulkRemoveLoading(false)
    }
  }

  const selectableMembers = members.filter((member) => !member.is_leader)
  const allSelectableSelected = selectableMembers.length > 0 && selectedMembers.size === selectableMembers.length
  const someSelected = selectedMembers.size > 0

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
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => router.push("/admin/teams")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Teams
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
                <Users className="h-8 w-8 text-primary" />
                Manage Members - {team?.name}
              </h1>
              <p className="text-muted-foreground">
                Manage team members, view their contributions, and track team performance.
              </p>
            </div>
          </div>
          {team && <AddMemberModal teamId={team.id} onSuccess={loadData} />}
        </div>

        {someSelected && (
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <UserPlus className="h-5 w-5 text-primary" />
                  <div>
                    <p className="font-medium">{selectedMembers.size} member(s) selected</p>
                    <p className="text-sm text-muted-foreground">Choose an action to apply to selected members</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" onClick={() => setSelectedMembers(new Set())}>
                    Clear Selection
                  </Button>
                  <Button variant="destructive" onClick={handleBulkRemove} disabled={bulkRemoveLoading}>
                    <Trash2 className="h-4 w-4 mr-2" />
                    {bulkRemoveLoading ? "Removing..." : `Remove ${selectedMembers.size} Member(s)`}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Team Information</CardTitle>
            <CardDescription>{team?.description}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Current Members</p>
                <p className="text-2xl font-bold">
                  {members.length} / {team?.max_members}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Points</p>
                <p className="text-2xl font-bold text-primary">
                  {Math.round(members.reduce((sum, member) => sum + member.total_points, 0))}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total CO₂ Saved</p>
                <p className="text-2xl font-bold text-green-600">
                  {Math.round(members.reduce((sum, member) => sum + member.total_co2_saved, 0))}kg
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Actions</p>
                <p className="text-2xl font-bold text-accent">
                  {members.reduce((sum, member) => sum + member.verified_actions, 0)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Team Members ({members.length})</CardTitle>
            <CardDescription>All members of this team and their contributions</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]">
                    <Checkbox
                      checked={allSelectableSelected}
                      onCheckedChange={handleSelectAll}
                      disabled={selectableMembers.length === 0}
                    />
                  </TableHead>
                  <TableHead>Member</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Points</TableHead>
                  <TableHead>CO₂ Saved</TableHead>
                  <TableHead>Actions</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead className="w-[50px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell>
                      <Checkbox
                        checked={selectedMembers.has(member.id)}
                        onCheckedChange={(checked) => handleSelectMember(member.id, checked as boolean)}
                        disabled={member.is_leader}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10">
                          <AvatarFallback>
                            {member.full_name
                              ?.split(" ")
                              .map((n) => n[0])
                              .join("")}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{member.full_name}</p>
                          <p className="text-sm text-muted-foreground flex items-center gap-1">
                            <Mail className="h-3 w-3" />
                            {member.email}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {member.is_leader ? (
                        <Badge variant="default" className="flex items-center gap-1 w-fit">
                          <Crown className="h-3 w-3" />
                          Team Leader
                        </Badge>
                      ) : (
                        <Badge variant="secondary">Member</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="font-medium text-primary">{member.total_points}</span>
                    </TableCell>
                    <TableCell>
                      <span className="font-medium text-green-600">{Math.round(member.total_co2_saved)}kg</span>
                    </TableCell>
                    <TableCell>
                      <span className="font-medium">{member.verified_actions}</span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        {new Date(member.joined_at).toLocaleDateString()}
                      </div>
                    </TableCell>
                    <TableCell>
                      {!member.is_leader && team ? (
                        <div className="relative">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              toggleDropdown(member.id, e)
                            }}
                            className="p-2 hover:bg-gray-100 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </button>

                          {openDropdown === member.id && (
                            <>
                              <div className="fixed inset-0 z-40" onClick={() => setOpenDropdown(null)} />
                              <div
                                className="fixed w-48 bg-white border border-gray-200 rounded-md shadow-lg z-50"
                                style={{
                                  top: dropdownPosition.top,
                                  bottom: dropdownPosition.bottom,
                                  left: dropdownPosition.left,
                                  right: dropdownPosition.right,
                                }}
                              >
                                <div className="py-1">
                                  <button
                                    onClick={() => {
                                      handleRemoveMember(member)
                                    }}
                                    className="flex items-center gap-2 w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                                  >
                                    <UserMinus className="h-4 w-4" />
                                    Remove Member
                                  </button>
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">Team Leader</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {team && (
        <RemoveMemberModal
          member={
            memberToRemove
              ? {
                  id: memberToRemove.id,
                  full_name: memberToRemove.full_name,
                  email: memberToRemove.email,
                  role: memberToRemove.is_leader ? "Team Leader" : "Member",
                }
              : null
          }
          teamId={team.id}
          open={removeModalOpen}
          onOpenChange={setRemoveModalOpen}
          onSuccess={loadData}
        />
      )}
    </main>
  )
}
