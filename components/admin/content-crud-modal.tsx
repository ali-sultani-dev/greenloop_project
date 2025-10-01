"use client"

import type React from "react"
import { useEffect, useState } from "react"
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
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { Loader2, X } from "lucide-react"

interface ContentItem {
  id?: string
  title: string
  content: string
  type: "action" | "announcement" | "educational"
  category: string
  status: "draft" | "published" | "archived"
  points?: number
  co2_impact?: number
  tags: string[]
  created_at?: string
  updated_at?: string
  description?: string
}

interface ContentCrudModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (content: ContentItem) => void
  content?: ContentItem | null
  mode: "create" | "edit" | "view"
  currentAdminId?: string
  restrictedType?: "announcement" | "educational"
}

export function ContentCrudModal({
  isOpen,
  onClose,
  onSave,
  content,
  mode,
  currentAdminId,
  restrictedType,
}: ContentCrudModalProps) {
  const [formData, setFormData] = useState<ContentItem>({
    title: "",
    content: "",
    type: "action",
    category: "",
    status: "draft",
    points: 0,
    co2_impact: 0,
    tags: [],
  })

  const [newTag, setNewTag] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [availableCategories, setAvailableCategories] = useState<Array<{ id: string; name: string }>>([])
  const { toast } = useToast()
  const supabase = createClient()

  useEffect(() => {
    const loadCategories = async () => {
      const { data: categories } = await supabase
        .from("action_categories")
        .select("id, name")
        .eq("is_active", true)
        .order("name")

      setAvailableCategories(categories || [])
    }

    if (isOpen) {
      loadCategories()
    }
  }, [isOpen])

  useEffect(() => {
    if (content) {
      setFormData({
        title: content.title || "",
        content: content.content || content.description || "",
        type: content.type || "action",
        category: content.category || "",
        status: content.status || "draft",
        points: content.points || 0,
        co2_impact: content.co2_impact || 0,
        tags: content.tags || [],
      })
    } else {
      const defaultType = restrictedType || "action"
      setFormData({
        title: "",
        content: "",
        type: defaultType,
        category: "",
        status: "draft",
        points: 0,
        co2_impact: 0,
        tags: [],
      })
    }
  }, [content, isOpen, restrictedType])

  const logAdminActivity = async (action: string, targetId: string, details: any) => {
    if (!currentAdminId) return

    try {
      await supabase.rpc("log_admin_activity", {
        p_admin_user_id: currentAdminId,
        p_action: action,
        p_resource_type: "content_items",
        p_resource_id: targetId,
        p_details: details,
      })
    } catch (error) {
      console.error("Failed to log admin activity:", error)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      if (content?.id) {
        if (formData.type === "action") {
          const selectedCategory = availableCategories.find((cat) => cat.name === formData.category)
          if (!selectedCategory) {
            throw new Error("Please select a valid category")
          }

          let isActive: boolean
          if (formData.status === "published") {
            isActive = true
          } else if (formData.status === "archived") {
            isActive = false
          } else {
            isActive = false // Only draft is inactive now
          }

          const response = await fetch(`/api/sustainability-actions/${content.id}`, {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              title: formData.title,
              description: formData.content,
              category_id: selectedCategory.id,
              points_value: formData.points,
              co2_impact: formData.co2_impact,
              is_active: isActive,
              status: formData.status,
            }),
          })

          if (!response.ok) {
            const errorData = await response.json()
            throw new Error(errorData.error || "Failed to update sustainability action")
          }
        } else {
          const { error } = await supabase
            .from("content_items")
            .update({
              title: formData.title,
              content: formData.content,
              type: formData.type,
              category: formData.category,
              status: formData.status,
              points: formData.points,
              co2_impact: formData.co2_impact,
              tags: formData.tags,
            })
            .eq("id", content.id)

          if (error) throw error
        }

        await logAdminActivity("content_updated", content.id, {
          title: formData.title,
          type: formData.type,
          status: formData.status,
        })

        toast({
          title: "Success",
          description: "Content updated successfully",
        })
      } else {
        if (!currentAdminId) {
          throw new Error("Admin ID is required to create content")
        }

        if (formData.type === "action") {
          const selectedCategory = availableCategories.find((cat) => cat.name === formData.category)
          if (!selectedCategory) {
            throw new Error("Please select a valid category")
          }

          let isActive: boolean
          if (formData.status === "published") {
            isActive = true
          } else if (formData.status === "archived") {
            isActive = false
          } else {
            isActive = false // Only draft is inactive now
          }

          const response = await fetch("/api/sustainability-actions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              title: formData.title,
              description: formData.content,
              category_id: selectedCategory.id,
              points_value: formData.points,
              co2_impact: formData.co2_impact,
              is_active: isActive,
              status: formData.status,
            }),
          })

          if (!response.ok) {
            const errorData = await response.json()
            throw new Error(errorData.error || "Failed to create sustainability action")
          }

          const result = await response.json()
          if (result.data) {
            await logAdminActivity("sustainability_action_created", result.data.id, {
              title: formData.title,
              category: formData.category,
            })
          }
        } else {
          const { data, error } = await supabase
            .from("content_items")
            .insert([
              {
                title: formData.title,
                content: formData.content,
                type: formData.type,
                category: formData.category,
                status: formData.status,
                points: formData.points,
                co2_impact: formData.co2_impact,
                tags: formData.tags,
                created_by: currentAdminId,
              },
            ])
            .select()
            .single()

          if (error) throw error

          if (data) {
            await logAdminActivity("content_created", data.id, {
              title: formData.title,
              type: formData.type,
              category: formData.category,
            })
          }
        }

        toast({
          title: "Success",
          description: "Content created successfully",
        })
      }

      await onSave(formData)
      onClose()
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Something went wrong",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const addTag = () => {
    if (newTag.trim() && !formData.tags.includes(newTag.trim())) {
      setFormData((prev) => ({
        ...prev,
        tags: [...prev.tags, newTag.trim()],
      }))
      setNewTag("")
    }
  }

  const removeTag = (tagToRemove: string) => {
    setFormData((prev) => ({
      ...prev,
      tags: prev.tags.filter((tag) => tag !== tagToRemove),
    }))
  }

  const isReadOnly = mode === "view"

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" && "Create New Content"}
            {mode === "edit" && "Edit Content"}
            {mode === "view" && "View Content"}
          </DialogTitle>
          <DialogDescription>
            {mode === "create" && "Add new sustainability content to the platform."}
            {mode === "edit" && "Update the content information."}
            {mode === "view" && "View content details."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
                placeholder="Enter content title"
                required
                disabled={isReadOnly}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="type">Type</Label>
              <Select
                value={formData.type}
                onValueChange={(value: ContentItem["type"]) => setFormData((prev) => ({ ...prev, type: value }))}
                disabled={isReadOnly || !!restrictedType} // Disable type selection if restricted
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select content type" />
                </SelectTrigger>
                <SelectContent>
                  {(!restrictedType || restrictedType === "announcement") && (
                    <SelectItem value="announcement">Announcement</SelectItem>
                  )}
                  {(!restrictedType || restrictedType === "educational") && (
                    <SelectItem value="educational">Educational Content</SelectItem>
                  )}
                  {!restrictedType && <SelectItem value="action">Sustainability Action</SelectItem>}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="content">Content</Label>
            <Textarea
              id="content"
              value={formData.content}
              onChange={(e) => setFormData((prev) => ({ ...prev, content: e.target.value }))}
              placeholder="Enter content description"
              rows={4}
              required
              disabled={isReadOnly}
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Select
                value={formData.category}
                onValueChange={(value) => setFormData((prev) => ({ ...prev, category: value }))}
                disabled={isReadOnly}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {formData.type === "action" ? (
                    availableCategories.map((category) => (
                      <SelectItem key={category.id} value={category.name}>
                        {category.name}
                      </SelectItem>
                    ))
                  ) : (
                    <>
                      <SelectItem value="Energy">Energy</SelectItem>
                      <SelectItem value="Transportation">Transportation</SelectItem>
                      <SelectItem value="Waste">Waste</SelectItem>
                      <SelectItem value="Water">Water</SelectItem>
                      <SelectItem value="Food">Food</SelectItem>
                      <SelectItem value="General">General</SelectItem>
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value: ContentItem["status"]) => setFormData((prev) => ({ ...prev, status: value }))}
                disabled={isReadOnly}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="published">Published</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {formData.type === "action" && (
              <div className="space-y-2">
                <Label htmlFor="points">Points</Label>
                <Input
                  id="points"
                  type="number"
                  value={formData.points}
                  onChange={(e) => setFormData((prev) => ({ ...prev, points: Number.parseInt(e.target.value) || 0 }))}
                  placeholder="0"
                  min="0"
                  disabled={isReadOnly}
                />
              </div>
            )}
          </div>

          {formData.type === "action" && (
            <div className="space-y-2">
              <Label htmlFor="co2_impact">CO₂ Impact (kg)</Label>
              <Input
                id="co2_impact"
                type="number"
                step="0.1"
                value={formData.co2_impact}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, co2_impact: Number.parseFloat(e.target.value) || 0 }))
                }
                placeholder="0.0"
                min="0"
                disabled={isReadOnly}
              />
            </div>
          )}

          <div className="space-y-2">
            <Label>Tags</Label>
            <div className="flex flex-wrap gap-2 mb-2">
              {formData.tags.map((tag, index) => (
                <Badge key={index} variant="secondary" className="flex items-center gap-1">
                  {tag}
                  {!isReadOnly && <X className="h-3 w-3 cursor-pointer" onClick={() => removeTag(tag)} />}
                </Badge>
              ))}
            </div>
            {!isReadOnly && (
              <div className="flex gap-2">
                <Input
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  placeholder="Add a tag"
                  onKeyPress={(e) => e.key === "Enter" && (e.preventDefault(), addTag())}
                />
                <Button type="button" onClick={addTag} variant="outline">
                  Add Tag
                </Button>
              </div>
            )}
          </div>

          {!isReadOnly && (
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Saving...
                  </>
                ) : mode === "create" ? (
                  "Create Content"
                ) : (
                  "Update Content"
                )}
              </Button>
            </DialogFooter>
          )}
        </form>
      </DialogContent>
    </Dialog>
  )
}
