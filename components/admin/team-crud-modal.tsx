"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { Loader2 } from "lucide-react"

interface Team {
  id?: string
  name: string
  description: string
  team_leader_id: string
  max_members: number
  is_active: boolean
}

interface TeamCrudModalProps {
  isOpen: boolean
  onClose: () => void
  team?: Team | null
  onSuccess: () => void
  currentAdminId?: string
}

export function TeamCrudModal({ isOpen, onClose, team, onSuccess, currentAdminId }: TeamCrudModalProps) {
  const [loading, setLoading] = useState(false)
  const [users, setUsers] = useState<any[]>([])
  const [formData, setFormData] = useState<Team>({
    name: "",
    description: "",
    team_leader_id: "",
    max_members: 10,
    is_active: true,
  })

  const { toast } = useToast()
  const supabase = createClient()

  useEffect(() => {
    async function loadUsers() {
      const { data } = await supabase.from("users").select("id, first_name, last_name").eq("is_active", true)
      setUsers(data || [])
    }
    if (isOpen) {
      loadUsers()
    }
  }, [isOpen])

  useEffect(() => {
    if (team) {
      setFormData({
        name: team.name || "",
        description: team.description || "",
        team_leader_id: team.team_leader_id || "",
        max_members: team.max_members || 10,
        is_active: team.is_active ?? true,
      })
    } else {
      // Reset form for new team creation
      setFormData({
        name: "",
        description: "",
        team_leader_id: "",
        max_members: 10,
        is_active: true,
      })
    }
  }, [team, isOpen])

  const logAdminActivity = async (action: string, targetId: string, details: any) => {
    if (!currentAdminId) return

    try {
      await supabase.rpc("log_admin_activity", {
        p_admin_user_id: currentAdminId,
        p_action: action,
        p_resource_type: "teams",
        p_resource_id: targetId,
        p_details: details,
      })
    } catch (error) {
      console.error("Failed to log admin activity:", error)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      if (team?.id) {
        // Update existing team
        const { error } = await supabase
          .from("teams")
          .update({
            name: formData.name,
            description: formData.description,
            team_leader_id: formData.team_leader_id,
            max_members: formData.max_members,
            is_active: formData.is_active,
          })
          .eq("id", team.id)

        if (error) throw error

        await logAdminActivity("team_updated", team.id, {
          name: formData.name,
          team_leader_id: formData.team_leader_id,
          is_active: formData.is_active,
        })

        toast({
          title: "Success",
          description: "Team updated successfully",
        })
      } else {
        // Create new team
        const { data, error } = await supabase
          .from("teams")
          .insert([
            {
              name: formData.name,
              description: formData.description,
              team_leader_id: formData.team_leader_id,
              max_members: formData.max_members,
              is_active: formData.is_active,
              total_points: 0,
              total_co2_saved: 0,
            },
          ])
          .select()
          .single()

        if (error) throw error

        if (data) {
          await logAdminActivity("team_created", data.id, {
            name: formData.name,
            team_leader_id: formData.team_leader_id,
            max_members: formData.max_members,
          })
        }

        toast({
          title: "Success",
          description: "Team created successfully",
        })
      }

      onSuccess()
      onClose()
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Something went wrong",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!team?.id) return

    setLoading(true)
    try {
      const { error } = await supabase.from("teams").delete().eq("id", team.id)

      if (error) throw error

      await logAdminActivity("team_deleted", team.id, {
        name: team.name,
        team_leader_id: team.team_leader_id,
      })

      toast({
        title: "Success",
        description: "Team deleted successfully",
      })

      onSuccess()
      onClose()
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete team",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{team?.id ? "Edit Team" : "Create New Team"}</DialogTitle>
          <DialogDescription>
            {team?.id ? "Update team information and settings." : "Create a new team for collaboration."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Team Name</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="team_leader">Team Leader</Label>
            <Select
              value={formData.team_leader_id}
              onValueChange={(value) => setFormData({ ...formData, team_leader_id: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select team leader" />
              </SelectTrigger>
              <SelectContent>
                {users.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.first_name} {user.last_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="max_members">Maximum Members</Label>
            <Input
              id="max_members"
              type="number"
              min="1"
              max="50"
              value={formData.max_members}
              onChange={(e) => setFormData({ ...formData, max_members: Number.parseInt(e.target.value) || 10 })}
              required
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label htmlFor="is_active">Active Status</Label>
              <p className="text-sm text-muted-foreground">Team is active and accepting members</p>
            </div>
            <Switch
              id="is_active"
              checked={formData.is_active}
              onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
            />
          </div>

          <DialogFooter className="gap-2">
            {team?.id && (
              <Button type="button" variant="destructive" onClick={handleDelete} disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete"}
              </Button>
            )}
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : team?.id ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
