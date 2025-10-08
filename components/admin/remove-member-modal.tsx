"use client"

import { useState } from "react"
import { AlertTriangle, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"

interface Member {
  id: string
  full_name: string
  email: string
  role: string
}

interface RemoveMemberModalProps {
  member?: Member | null
  members?: Member[]
  teamId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
  bulkMode?: boolean
}

export function RemoveMemberModal({
  member,
  members = [],
  teamId,
  open,
  onOpenChange,
  onSuccess,
  bulkMode = false,
}: RemoveMemberModalProps) {
  const [loading, setLoading] = useState(false)
  const [selectedMembers, setSelectedMembers] = useState<Set<string>>(new Set())
  const { toast } = useToast()
  const router = useRouter()
  const supabase = createClient()

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setSelectedMembers(new Set())
    }
    onOpenChange(open)
  }

  const handleSelectMember = (memberId: string, checked: boolean | "indeterminate") => {
    const isChecked = checked === true
    const newSelected = new Set(selectedMembers)
    if (isChecked) {
      newSelected.add(memberId)
    } else {
      newSelected.delete(memberId)
    }
    setSelectedMembers(newSelected)
  }

  const handleSelectAllMembers = (checked: boolean | "indeterminate") => {
    const isChecked = checked === true
    if (isChecked) {
      setSelectedMembers(new Set(members.map((m) => m.id)))
    } else {
      setSelectedMembers(new Set())
    }
  }

  const handleRemoveMembers = async () => {
    const membersToRemove = bulkMode ? Array.from(selectedMembers) : member ? [member.id] : []

    if (membersToRemove.length === 0) return

    setLoading(true)
    try {
      const { error } = await supabase
        .from("team_members")
        .delete()
        .eq("team_id", teamId)
        .in("user_id", membersToRemove)

      if (error) throw error

      const successMessage = bulkMode
        ? `${membersToRemove.length} member(s) have been removed from the team`
        : `${member?.full_name} has been removed from the team`

      toast({
        title: "Success",
        description: successMessage,
      })

      handleOpenChange(false)
      onSuccess?.()
    } catch (error: any) {
      console.error("Remove member error:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to remove member(s)",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const allSelected = members.length > 0 && selectedMembers.size === members.length
  const membersToShow = bulkMode ? members : member ? [member] : []

  if (!bulkMode && !member) return null

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            {bulkMode ? "Remove Team Members" : "Remove Team Member"}
          </DialogTitle>
          <DialogDescription>
            This action cannot be undone. {bulkMode ? "Selected members" : "The member"} will lose access to team
            activities and challenges.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {bulkMode && members.length > 0 && (
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 p-2 border rounded-lg bg-muted/50">
                <Checkbox checked={allSelected} onCheckedChange={handleSelectAllMembers} />
                <span className="text-sm">Select all {members.length} member(s)</span>
              </div>
              {selectedMembers.size > 0 && <Badge variant="destructive">{selectedMembers.size} selected</Badge>}
            </div>
          )}

          <div className="max-h-60 overflow-y-auto space-y-2">
            {membersToShow.map((memberItem) => (
              <div
                key={memberItem.id}
                className={`p-4 border rounded-lg ${
                  bulkMode
                    ? selectedMembers.has(memberItem.id)
                      ? "bg-destructive/5 border-destructive/20"
                      : "bg-muted/50"
                    : "bg-muted/50"
                }`}
              >
                <div className="flex items-center gap-3">
                  {bulkMode && (
                    <Checkbox
                      checked={selectedMembers.has(memberItem.id)}
                      onCheckedChange={(checked) => handleSelectMember(memberItem.id, checked)}
                    />
                  )}
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10 text-destructive text-sm font-bold">
                    {memberItem.full_name
                      .split(" ")
                      .map((n) => n[0])
                      .join("")
                      .slice(0, 2)}
                  </div>
                  <div>
                    <p className="font-medium">{memberItem.full_name}</p>
                    <p className="text-sm text-muted-foreground">{memberItem.email}</p>
                    <p className="text-xs text-muted-foreground capitalize">{memberItem.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-start gap-3 p-3 bg-destructive/5 border border-destructive/20 rounded-lg">
            <Trash2 className="h-5 w-5 text-destructive mt-0.5" />
            <div>
              <p className="font-medium text-destructive">
                {bulkMode
                  ? `Are you sure you want to remove ${selectedMembers.size || "these"} member(s)?`
                  : `Are you sure you want to remove this member?`}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {bulkMode
                  ? "Selected members will be removed from the team and will no longer have access to team activities."
                  : `${member?.full_name} will be removed from the team and will no longer have access to team activities.`}
              </p>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleRemoveMembers}
            disabled={loading || (bulkMode && selectedMembers.size === 0)}
          >
            {loading ? "Removing..." : bulkMode ? `Remove ${selectedMembers.size} Member(s)` : "Remove Member"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
