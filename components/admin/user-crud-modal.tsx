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
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { Loader2, Award as IdCard, Briefcase } from "lucide-react"

interface User {
  id?: string
  first_name: string
  last_name: string
  email: string
  employee_id?: string
  job_title?: string
  department: string
  is_admin: boolean
  is_active: boolean
  points?: number
  level?: number
  total_co2_saved?: number
}

interface UserCrudModalProps {
  isOpen: boolean
  onClose: () => void
  user?: User | null
  mode: "view" | "edit" | "create"
  onSuccess: () => void
  currentAdminId?: string
}

export function UserCrudModal({ isOpen, onClose, user, mode, onSuccess, currentAdminId }: UserCrudModalProps) {
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState<User>({
    first_name: "",
    last_name: "",
    email: "",
    employee_id: "",
    job_title: "",
    department: "",
    is_admin: false,
    is_active: true,
    points: 0,
    level: 1,
    total_co2_saved: 0,
  })

  const { toast } = useToast()
  const supabase = createClient()

  const departments = [
    "Human Resources",
    "Engineering",
    "Marketing",
    "Sales",
    "Finance",
    "Operations",
    "Customer Support",
    "Legal",
    "IT",
    "Other",
  ]

  useEffect(() => {
    if (isOpen && user) {
      console.log("Loading user data:", user)
      setFormData({
        first_name: user.first_name || "",
        last_name: user.last_name || "",
        email: user.email || "",
        employee_id: user.employee_id || "",
        job_title: user.job_title || "",
        department: user.department || "",
        is_admin: user.is_admin || false,
        is_active: user.is_active ?? true,
        points: user.points || 0,
        level: user.level || 1,
        total_co2_saved: user.total_co2_saved || 0,
      })
    } else if (isOpen && !user) {
      // Reset form for create mode
      setFormData({
        first_name: "",
        last_name: "",
        email: "",
        employee_id: "",
        job_title: "",
        department: "",
        is_admin: false,
        is_active: true,
        points: 0,
        level: 1,
        total_co2_saved: 0,
      })
    }
  }, [isOpen, user])

  const logAdminActivity = async (action: string, targetId: string, details: any) => {
    if (!currentAdminId) return

    try {
      await supabase.rpc("log_admin_activity", {
        p_admin_user_id: currentAdminId,
        p_action: action,
        p_resource_type: "users",
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
      if (user?.id) {
        const { error } = await supabase
          .from("users")
          .update({
            first_name: formData.first_name,
            last_name: formData.last_name,
            email: formData.email,
            employee_id: formData.employee_id,
            job_title: formData.job_title,
            department: formData.department,
            is_admin: formData.is_admin,
            is_active: formData.is_active,
            points: formData.points,
            total_co2_saved: formData.total_co2_saved,
          })
          .eq("id", user.id)

        if (error) throw error

        await logAdminActivity("user_updated", user.id, {
          updated_fields: {
            first_name: formData.first_name,
            last_name: formData.last_name,
            email: formData.email,
            employee_id: formData.employee_id,
            job_title: formData.job_title,
            department: formData.department,
            is_admin: formData.is_admin,
            is_active: formData.is_active,
          },
        })

        toast({
          title: "Success",
          description: "User updated successfully",
        })
      } else {
        const response = await fetch("/api/admin/users", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: formData.email,
            firstName: formData.first_name,
            lastName: formData.last_name,
            employeeId: formData.employee_id,
            jobTitle: formData.job_title,
            department: formData.department,
            isAdmin: formData.is_admin,
          }),
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || "Failed to create user")
        }

        const { user: newUser } = await response.json()

        if (newUser && currentAdminId) {
          await logAdminActivity("user_created", newUser.id, {
            user_details: {
              first_name: formData.first_name,
              last_name: formData.last_name,
              email: formData.email,
              employee_id: formData.employee_id,
              job_title: formData.job_title,
              department: formData.department,
              is_admin: formData.is_admin,
            },
          })
        }

        toast({
          title: "Success",
          description: "User created successfully. An invitation email has been sent.",
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
    if (!user?.id) return

    setLoading(true)
    try {
      const { error } = await supabase.from("users").delete().eq("id", user.id)

      if (error) throw error

      await logAdminActivity("user_deleted", user.id, {
        deleted_user: {
          first_name: user.first_name,
          last_name: user.last_name,
          email: user.email,
        },
      })

      toast({
        title: "Success",
        description: "User deleted successfully",
      })

      onSuccess()
      onClose()
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete user",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {mode === "view" ? "User Details" : mode === "edit" ? "Edit User" : "Create New User"}
          </DialogTitle>
          <DialogDescription>
            {mode === "view"
              ? "View complete user information and activity details."
              : mode === "edit"
                ? "Update user information and permissions."
                : "Add a new user to the platform."}
          </DialogDescription>
        </DialogHeader>

        {mode === "view" ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>First Name</Label>
                <div className="p-2 bg-gray-50 rounded border">{formData.first_name}</div>
              </div>
              <div className="space-y-2">
                <Label>Last Name</Label>
                <div className="p-2 bg-gray-50 rounded border">{formData.last_name}</div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Email</Label>
              <div className="p-2 bg-gray-50 rounded border">{formData.email}</div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Employee ID</Label>
                <div className="p-2 bg-gray-50 rounded border">{formData.employee_id || "Not Set"}</div>
              </div>
              <div className="space-y-2">
                <Label>Job Title</Label>
                <div className="p-2 bg-gray-50 rounded border">{formData.job_title || "Not Set"}</div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Department</Label>
              <div className="p-2 bg-gray-50 rounded border">{formData.department || "Not Set"}</div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Points</Label>
                <div className="p-2 bg-gray-50 rounded border">{formData.points || 0}</div>
              </div>
              <div className="space-y-2">
                <Label>CO₂ Saved (kg)</Label>
                <div className="p-2 bg-gray-50 rounded border">{formData.total_co2_saved || 0}</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Administrator</Label>
                <div className="p-2 bg-gray-50 rounded border">{formData.is_admin ? "Yes" : "No"}</div>
              </div>
              <div className="space-y-2">
                <Label>Active Status</Label>
                <div className="p-2 bg-gray-50 rounded border">{formData.is_active ? "Active" : "Inactive"}</div>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                Close
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="first_name">First Name</Label>
                <Input
                  id="first_name"
                  value={formData.first_name}
                  onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="last_name">Last Name</Label>
                <Input
                  id="last_name"
                  value={formData.last_name}
                  onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="employee_id">Employee ID</Label>
                <div className="relative">
                  <IdCard className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="employee_id"
                    placeholder="EMP001"
                    value={formData.employee_id}
                    onChange={(e) => setFormData({ ...formData, employee_id: e.target.value })}
                    className="pl-10"
                    required={!user?.id}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="job_title">Job Title</Label>
                <div className="relative">
                  <Briefcase className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="job_title"
                    placeholder="Software Engineer"
                    value={formData.job_title}
                    onChange={(e) => setFormData({ ...formData, job_title: e.target.value })}
                    className="pl-10"
                    required={!user?.id}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="department">Department</Label>
              <Select
                value={formData.department}
                onValueChange={(value) => setFormData({ ...formData, department: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  {departments.map((dept) => (
                    <SelectItem key={dept} value={dept}>
                      {dept}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {mode === "edit" && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="points">Points</Label>
                  <Input
                    id="points"
                    type="number"
                    min="0"
                    value={formData.points || 0}
                    onChange={(e) => setFormData({ ...formData, points: Number(e.target.value) || 0 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="total_co2_saved">CO₂ Saved (kg)</Label>
                  <Input
                    id="total_co2_saved"
                    type="number"
                    min="0"
                    step="0.1"
                    value={formData.total_co2_saved || 0}
                    onChange={(e) => setFormData({ ...formData, total_co2_saved: Number(e.target.value) || 0 })}
                  />
                </div>
              </div>
            )}

            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label htmlFor="is_admin">Administrator</Label>
                <p className="text-sm text-muted-foreground">Grant admin privileges</p>
              </div>
              {mode === "edit" && (
                <Switch
                  id="is_admin"
                  checked={formData.is_admin}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_admin: checked })}
                />
              )}
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label htmlFor="is_active">Active Status</Label>
                <p className="text-sm text-muted-foreground">User can access the platform</p>
              </div>
              {mode === "edit" && (
                <Switch
                  id="is_active"
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                />
              )}
            </div>

            {mode === "create" && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
                <p className="text-sm text-blue-800">
                  <strong>Note:</strong> An invitation email will be sent to the user with instructions to set their
                  password.
                </p>
              </div>
            )}

            <DialogFooter className="gap-2">
              {mode === "edit" && user?.id && (
                <Button type="button" variant="destructive" onClick={handleDelete} disabled={loading}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete"}
                </Button>
              )}
              <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : mode === "edit" ? "Update" : "Create"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
