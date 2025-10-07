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
import { useToast } from "@/hooks/use-toast"
import { createClient } from "@/lib/supabase/client"

interface BadgeData {
  id: string
  name: string
  description: string
  badge_color: string
  user_count?: number
}

interface DeleteBadgeModalProps {
  badge: BadgeData | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

export function DeleteBadgeModal({ badge, open, onOpenChange, onSuccess }: DeleteBadgeModalProps) {
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()
  const supabase = createClient()

  const handleDeleteBadge = async () => {
    if (!badge) return

    setLoading(true)
    try {
      const { error } = await supabase.from("badges").delete().eq("id", badge.id)

      if (error) throw error

      toast({
        title: "Success",
        description: `${badge.name} badge has been deleted successfully`,
      })

      onOpenChange(false)
      onSuccess?.()
    } catch (error: any) {
      console.error("Delete badge error:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to delete badge",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  if (!badge) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Delete Badge
          </DialogTitle>
          <DialogDescription>
            This action cannot be undone. The badge will be permanently removed from the system.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="p-4 border rounded-lg bg-muted/50">
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center"
                style={{ backgroundColor: badge.badge_color }}
              >
                <div className="text-white text-sm font-bold">
                  {badge.name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                    .slice(0, 2)}
                </div>
              </div>
              <div>
                <p className="font-medium">{badge.name}</p>
                <p className="text-sm text-muted-foreground">{badge.description}</p>
                {badge.user_count !== undefined && (
                  <p className="text-xs text-muted-foreground">
                    Earned by {badge.user_count} user{badge.user_count !== 1 ? "s" : ""}
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 bg-destructive/5 border border-destructive/20 rounded-lg">
            <Trash2 className="h-5 w-5 text-destructive mt-0.5" />
            <div>
              <p className="font-medium text-destructive">Are you sure you want to delete this badge?</p>
              <p className="text-sm text-muted-foreground mt-1">
                This will permanently remove the badge and all associated user achievements. Users who earned this badge
                will lose it from their profiles.
              </p>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleDeleteBadge} disabled={loading}>
            {loading ? "Deleting..." : "Delete Badge"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
