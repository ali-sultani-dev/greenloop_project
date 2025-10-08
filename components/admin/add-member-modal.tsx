"use client"

import { useState, useEffect } from "react"
import { Plus, Search, UserPlus } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"

interface User {
  id: string
  first_name: string
  last_name: string
  email: string
}

interface AddMemberModalProps {
  teamId: string
  onSuccess?: () => void
}

export function AddMemberModal({ teamId, onSuccess }: AddMemberModalProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [availableUsers, setAvailableUsers] = useState<User[]>([])
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set())
  const [bulkMode, setBulkMode] = useState(false)
  const { toast } = useToast()
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    if (open) {
      loadAvailableUsers()
      setSelectedUser(null)
      setSelectedUsers(new Set())
      setBulkMode(false)
      setSearchTerm("")
    }
  }, [open])

  const loadAvailableUsers = async () => {
    try {
      const { data: existingMembers } = await supabase.from("team_members").select("user_id").eq("team_id", teamId)

      const existingMemberIds = existingMembers?.map((m) => m.user_id) || []

      const { data: team } = await supabase.from("teams").select("team_leader_id").eq("id", teamId).single()

      const excludeIds = [...existingMemberIds]

      let query = supabase
        .from("users")
        .select("id, first_name, last_name, email")
        .eq("is_active", true)
        .order("first_name")

      if (excludeIds.length > 0) {
        query = query.not("id", "in", `(${excludeIds.join(",")})`)
      }

      const { data: users } = await query
      setAvailableUsers(users || [])
    } catch (error) {
      console.error("Failed to load available users:", error)
      toast({
        title: "Error",
        description: "Failed to load available users",
        variant: "destructive",
      })
    }
  }

  const filteredUsers = availableUsers.filter((user) =>
    `${user.first_name} ${user.last_name} ${user.email}`.toLowerCase().includes(searchTerm.toLowerCase()),
  )

  const handleSelectAllUsers = (checked: boolean | "indeterminate") => {
    const isChecked = checked === true
    if (isChecked) {
      setSelectedUsers(new Set(filteredUsers.map((user) => user.id)))
    } else {
      setSelectedUsers(new Set())
    }
  }

  const handleSelectUser = (userId: string, checked: boolean) => {
    const newSelected = new Set(selectedUsers)
    if (checked) {
      newSelected.add(userId)
    } else {
      newSelected.delete(userId)
    }
    setSelectedUsers(newSelected)
  }

  const handleAddMembers = async () => {
    const usersToAdd = bulkMode ? Array.from(selectedUsers) : selectedUser ? [selectedUser.id] : []

    if (usersToAdd.length === 0) return

    setLoading(true)
    try {
      const membersToInsert = usersToAdd.map((userId) => ({
        team_id: teamId,
        user_id: userId,
        role: "member",
        joined_at: new Date().toISOString(),
      }))

      const { error } = await supabase.from("team_members").insert(membersToInsert)

      if (error) {
        if (error.code === "23505") {
          throw new Error("One or more selected users are already members of this team")
        }
        throw error
      }

      const successMessage = bulkMode
        ? `${usersToAdd.length} member(s) have been added to the team`
        : `${selectedUser?.first_name} ${selectedUser?.last_name} has been added to the team`

      toast({
        title: "Success",
        description: successMessage,
      })

      setOpen(false)
      setSelectedUser(null)
      setSelectedUsers(new Set())
      setBulkMode(false)
      setSearchTerm("")
      onSuccess?.()
    } catch (error: any) {
      console.error("Add member error:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to add member(s)",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const allFilteredSelected = filteredUsers.length > 0 && selectedUsers.size === filteredUsers.length

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Add Member
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Add Team Member(s)</DialogTitle>
          <DialogDescription>
            {bulkMode ? "Select multiple users to add to this team." : "Search and select a user to add to this team."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="bulk-mode"
                checked={bulkMode}
                onCheckedChange={(checked) => setBulkMode(checked === true)}
              />
              <Label htmlFor="bulk-mode" className="text-sm font-medium">
                Bulk add mode
              </Label>
            </div>
            {bulkMode && selectedUsers.size > 0 && <Badge variant="secondary">{selectedUsers.size} selected</Badge>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="search">Search Users</Label>
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                id="search"
                placeholder="Search by name or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>

          {bulkMode && filteredUsers.length > 0 && (
            <div className="flex items-center space-x-2 p-2 border rounded-lg bg-muted/50">
              <Checkbox checked={allFilteredSelected} onCheckedChange={handleSelectAllUsers} />
              <Label className="text-sm">Select all {filteredUsers.length} user(s)</Label>
            </div>
          )}

          <div className="max-h-60 overflow-y-auto space-y-2">
            {filteredUsers.length > 0 ? (
              filteredUsers.map((user) => (
                <div
                  key={user.id}
                  className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                    bulkMode
                      ? selectedUsers.has(user.id)
                        ? "border-primary bg-primary/5"
                        : "hover:bg-muted"
                      : selectedUser?.id === user.id
                        ? "border-primary bg-primary/5"
                        : "hover:bg-muted"
                  }`}
                  onClick={() => {
                    if (bulkMode) {
                      handleSelectUser(user.id, !selectedUsers.has(user.id))
                    } else {
                      setSelectedUser(user)
                    }
                  }}
                >
                  <div className="flex items-center gap-3">
                    {bulkMode && (
                      <Checkbox
                        checked={selectedUsers.has(user.id)}
                        onCheckedChange={(checked) => handleSelectUser(user.id, checked === true)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    )}
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold">
                      {user.first_name[0]}
                      {user.last_name[0]}
                    </div>
                    <div>
                      <p className="font-medium">
                        {user.first_name} {user.last_name}
                      </p>
                      <p className="text-sm text-muted-foreground">{user.email}</p>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <UserPlus className="mx-auto h-12 w-12 mb-4" />
                <p>No available users found</p>
                <p className="text-sm">All active users are already in this team</p>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleAddMembers}
            disabled={loading || (bulkMode ? selectedUsers.size === 0 : !selectedUser)}
          >
            {loading ? "Adding..." : bulkMode ? `Add ${selectedUsers.size} Member(s)` : "Add Member"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
