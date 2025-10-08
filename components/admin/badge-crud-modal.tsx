"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { useToast } from "@/hooks/use-toast"
import { Loader2 } from "lucide-react"

interface Badge {
  id: string
  name: string
  description: string
  icon_url: string | null
  criteria_type: string
  criteria_value: number
  badge_color: string
  is_active: boolean
  created_at: string
}

interface BadgeCrudModalProps {
  isOpen: boolean
  onClose: () => void
  badge?: Badge | null
  onSuccess: () => void
}

const CRITERIA_TYPES = [
  { value: "points", label: "Points Earned" },
  { value: "actions", label: "Actions Completed" },
  { value: "co2_saved", label: "CO2 Saved (kg)" },
]

const BADGE_COLORS = [
  { value: "#F59E0B", label: "Gold", color: "#F59E0B" },
  { value: "#EF4444", label: "Red", color: "#EF4444" },
  { value: "#3B82F6", label: "Blue", color: "#3B82F6" },
  { value: "#10B981", label: "Green", color: "#10B981" },
  { value: "#8B5CF6", label: "Purple", color: "#8B5CF6" },
  { value: "#F97316", label: "Orange", color: "#F97316" },
  { value: "#06B6D4", label: "Cyan", color: "#06B6D4" },
  { value: "#84CC16", label: "Lime", color: "#84CC16" },
]

export function BadgeCrudModal({ isOpen, onClose, badge, onSuccess }: BadgeCrudModalProps) {
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    icon_url: "",
    criteria_type: "points",
    criteria_value: 0,
    badge_color: "#F59E0B",
    is_active: true,
  })

  const { toast } = useToast()
  const supabase = createClient()

  useEffect(() => {
    if (badge) {
      setFormData({
        name: badge.name,
        description: badge.description,
        icon_url: badge.icon_url || "",
        criteria_type: badge.criteria_type,
        criteria_value: badge.criteria_value,
        badge_color: badge.badge_color,
        is_active: badge.is_active,
      })
    } else {
      setFormData({
        name: "",
        description: "",
        icon_url: "",
        criteria_type: "points",
        criteria_value: 0,
        badge_color: "#F59E0B",
        is_active: true,
      })
    }
  }, [badge])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      if (badge) {
        // Update existing badge
        const { error } = await supabase
          .from("badges")
          .update({
            name: formData.name,
            description: formData.description,
            icon_url: formData.icon_url || null,
            criteria_type: formData.criteria_type,
            criteria_value: formData.criteria_value,
            badge_color: formData.badge_color,
            is_active: formData.is_active,
          })
          .eq("id", badge.id)

        if (error) throw error

        toast({
          title: "Success",
          description: "Badge updated successfully",
        })
      } else {
        // Create new badge
        const { error } = await supabase.from("badges").insert([
          {
            name: formData.name,
            description: formData.description,
            icon_url: formData.icon_url || null,
            criteria_type: formData.criteria_type,
            criteria_value: formData.criteria_value,
            badge_color: formData.badge_color,
            is_active: formData.is_active,
          },
        ])

        if (error) throw error

        toast({
          title: "Success",
          description: "Badge created successfully",
        })
      }

      onSuccess()
      onClose()
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to save badge",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const getCriteriaLabel = (type: string) => {
    const criteriaType = CRITERIA_TYPES.find((ct) => ct.value === type)
    return criteriaType?.label || type
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{badge ? "Edit Badge" : "Create New Badge"}</DialogTitle>
          <DialogDescription>
            {badge ? "Update the badge details below." : "Create a new badge for users to earn."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Badge Name</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Eco Warrior"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Describe what this badge represents..."
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="icon_url">Icon URL (optional)</Label>
            <Input
              id="icon_url"
              value={formData.icon_url}
              onChange={(e) => setFormData({ ...formData, icon_url: e.target.value })}
              placeholder="https://example.com/icon.png"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="criteria_type">Criteria Type</Label>
              <Select
                value={formData.criteria_type}
                onValueChange={(value) => setFormData({ ...formData, criteria_type: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CRITERIA_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="criteria_value">Threshold ({getCriteriaLabel(formData.criteria_type)})</Label>
              <Input
                id="criteria_value"
                type="number"
                min="0"
                value={formData.criteria_value}
                onChange={(e) => setFormData({ ...formData, criteria_value: Number.parseInt(e.target.value) || 0 })}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="badge_color">Badge Color</Label>
            <Select
              value={formData.badge_color}
              onValueChange={(value) => setFormData({ ...formData, badge_color: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BADGE_COLORS.map((color) => (
                  <SelectItem key={color.value} value={color.value}>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded-full border" style={{ backgroundColor: color.color }} />
                      {color.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="is_active"
              checked={formData.is_active}
              onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
            />
            <Label htmlFor="is_active">Active (users can earn this badge)</Label>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {badge ? "Update Badge" : "Create Badge"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
