"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { UserPlus, UserMinus, MoreHorizontal, AlertCircle, Trash2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface User {
  id: string
  first_name: string
  last_name: string
  email: string
  department: string
  job_title: string
}

interface TeamMemberActionsProps {
  teamId: string
  memberId?: string
  memberName?: string
  memberEmail?: string
  isTeamLeader: boolean
  isAdmin: boolean
}

export function TeamMemberActions({
  teamId,
  memberId,
  memberName,
  memberEmail,
  isTeamLeader,
  isAdmin,
}: TeamMemberActionsProps) {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isRemoveDialogOpen, setIsRemoveDialogOpen] = useState(false)
  const [selectedUserId, setSelectedUserId] = useState("")
  const [departmentFilter, setDepartmentFilter] = useState("all")
  const [availableUsers, setAvailableUsers] = useState<User[]>([])
  const [departments, setDepartments] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [openDropdown, setOpenDropdown] = useState<string | null>(null)
  const [dropdownPosition, setDropdownPosition] = useState<{
    top?: number
    bottom?: number
    left?: number
    right?: number
  }>({})
  const router = useRouter()
  const { toast } = useToast()

  useEffect(() => {
    if (isAddDialogOpen) {
      fetchAvailableUsers()
    }
  }, [isAddDialogOpen])

  useEffect(() => {
    const handleClickOutside = () => {
      setOpenDropdown(null)
    }

    if (openDropdown) {
      document.addEventListener("click", handleClickOutside)
      return () => document.removeEventListener("click", handleClickOutside)
    }
  }, [openDropdown])

  const fetchAvailableUsers = async () => {
    try {
      const response = await fetch(`/api/teams/${teamId}/available-users`)
      if (response.ok) {
        const data = await response.json()
        setAvailableUsers(data.users)
        setDepartments(data.departments)
      }
    } catch (error) {
      console.error("Failed to fetch available users:", error)
    }
  }

  const toggleDropdown = (memberIdParam: string, event?: React.MouseEvent) => {
    if (openDropdown === memberIdParam) {
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

    setOpenDropdown(memberIdParam)
  }

  const handleAddMember = async () => {
    if (!selectedUserId) return

    setIsLoading(true)
    setError(null)

    try {
      const selectedUser = availableUsers.find((u) => u.id === selectedUserId)
      const response = await fetch(`/api/teams/${teamId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: selectedUser?.email }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to add member")
      }

      toast({
        title: "Success",
        description: `${selectedUser?.first_name} ${selectedUser?.last_name} has been added to the team`,
      })

      setSelectedUserId("")
      setIsAddDialogOpen(false)
      router.refresh()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleRemoveMember = async () => {
    if (!memberId) return

    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/teams/${teamId}/members/${memberId}`, {
        method: "DELETE",
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to remove member")
      }

      toast({
        title: "Success",
        description: `${memberName} has been removed from the team`,
      })

      setIsRemoveDialogOpen(false)
      router.refresh()
    } catch (err: any) {
      setError(err.message)
      toast({
        title: "Error",
        description: err.message || "Failed to remove member",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  if (!isTeamLeader && !isAdmin) {
    return null
  }

  const filteredUsers = availableUsers.filter(
    (user) => departmentFilter === "all" || user.department === departmentFilter,
  )

  return (
    <>
      {/* Add Member Button */}
      {!memberId && (
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              <UserPlus className="h-4 w-4 mr-2" />
              Add Member
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Add Team Member</DialogTitle>
              <DialogDescription>Select a user from your organization to add to the team.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="department">Filter by Department</Label>
                <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All departments" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Departments</SelectItem>
                    {departments.map((dept) => (
                      <SelectItem key={dept} value={dept}>
                        {dept}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="user">Select User</Label>
                <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a user..." />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredUsers.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        <div className="flex flex-col">
                          <span>
                            {user.first_name} {user.last_name}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {user.department} • {user.email}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              <div className="flex gap-3">
                <Button onClick={handleAddMember} disabled={isLoading || !selectedUserId}>
                  {isLoading ? "Adding..." : "Add Member"}
                </Button>
                <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Remove Member Dropdown - Updated to match admin panel exactly */}
      {memberId && (
        <>
          <div className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation()
                toggleDropdown(memberId, e)
              }}
              className="p-2 hover:bg-gray-100 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>

            {openDropdown === memberId && (
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
                        setIsRemoveDialogOpen(true)
                        setOpenDropdown(null)
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

          <Dialog open={isRemoveDialogOpen} onOpenChange={setIsRemoveDialogOpen}>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <UserMinus className="h-5 w-5 text-destructive" />
                  Remove Team Member
                </DialogTitle>
                <DialogDescription>
                  This action cannot be undone. The member will lose access to team activities and challenges.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="p-4 border rounded-lg bg-muted/50">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10 text-destructive text-sm font-bold">
                      {memberName
                        ?.split(" ")
                        .map((n) => n[0])
                        .join("")
                        .slice(0, 2)}
                    </div>
                    <div>
                      <p className="font-medium">{memberName}</p>
                      <p className="text-sm text-muted-foreground">{memberEmail || "Team Member"}</p>
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 bg-destructive/5 border border-destructive/20 rounded-lg">
                  <Trash2 className="h-5 w-5 text-destructive mt-0.5" />
                  <div>
                    <p className="font-medium text-destructive">Are you sure you want to remove this member?</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {memberName} will be removed from the team and will no longer have access to team activities.
                    </p>
                  </div>
                </div>

                {error && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}
              </div>

              <div className="flex gap-3 justify-end">
                <Button variant="outline" onClick={() => setIsRemoveDialogOpen(false)} disabled={isLoading}>
                  Cancel
                </Button>
                <Button variant="destructive" onClick={handleRemoveMember} disabled={isLoading}>
                  {isLoading ? "Removing..." : "Remove Member"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </>
      )}
    </>
  )
}
