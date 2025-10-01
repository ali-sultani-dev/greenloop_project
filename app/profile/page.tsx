"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Navigation } from "@/components/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { User, Award, Target, Leaf, Save, AlertCircle, CheckCircle, Camera } from "lucide-react"

export default function ProfilePage() {
  const [user, setUser] = useState<any>(null)
  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    email: "",
    department: "",
    job_title: "",
    employee_id: "",
  })
  const [profilePhoto, setProfilePhoto] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [stats, setStats] = useState<any>(null)
  const router = useRouter()
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
    async function loadProfile() {
      try {
        const { data: userData, error: userError } = await supabase.auth.getUser()
        if (userError || !userData?.user) {
          router.push("/auth/login")
          return
        }

        const response = await fetch("/api/profile", {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        })

        if (!response.ok) {
          throw new Error("Failed to fetch profile")
        }

        const data = await response.json()
        const { profile, stats: profileStats } = data

        if (profile) {
          setUser(profile)
          setFormData({
            first_name: profile.first_name || "",
            last_name: profile.last_name || "",
            email: profile.email || "",
            department: profile.department || "",
            job_title: profile.job_title || "",
            employee_id: profile.employee_id || "",
          })
        }

        setStats(profileStats)
      } catch (err) {
        setError("Failed to load profile")
      } finally {
        setIsLoading(false)
      }
    }

    loadProfile()
  }, [router, supabase])

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]

    if (file) {
      // Validate file type
      if (!file.type.startsWith("image/")) {
        setError("Please select an image file")
        return
      }

      // Validate file size (5MB limit)
      if (file.size > 5 * 1024 * 1024) {
        setError("Image must be smaller than 5MB")
        return
      }

      setProfilePhoto(file)

      // Create preview
      const reader = new FileReader()
      reader.onload = (e) => {
        setPhotoPreview(e.target?.result as string)
      }
      reader.readAsDataURL(file)
      setError(null)
    }
  }

  const uploadProfilePhoto = async () => {
    if (!profilePhoto || !user) return null

    setIsUploadingPhoto(true)

    try {
      const fileExt = profilePhoto.name.split(".").pop()
      const fileName = `${user.id}/profile_${Date.now()}.${fileExt}`

      // Delete old profile photo if exists
      if (user.avatar_url) {
        const oldPath = user.avatar_url.split("/").pop()
        if (oldPath) {
          await supabase.storage.from("profile-photos").remove([`${user.id}/${oldPath}`])
        }
      }

      // Upload new photo
      const { error: uploadError, data: uploadData } = await supabase.storage
        .from("profile-photos")
        .upload(fileName, profilePhoto)

      if (uploadError) {
        throw new Error(`Failed to upload photo: ${uploadError.message}`)
      }

      // Get public URL
      const { data: urlData } = supabase.storage.from("profile-photos").getPublicUrl(fileName)

      return urlData.publicUrl
    } catch (error) {
      console.error("Photo upload error:", error)
      throw error
    } finally {
      setIsUploadingPhoto(false)
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return

    setIsSaving(true)
    setError(null)
    setSuccess(false)

    try {
      let avatarUrl = user.avatar_url
      if (profilePhoto) {
        avatarUrl = await uploadProfilePhoto()
      }

      const response = await fetch("/api/profile", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          first_name: formData.first_name,
          last_name: formData.last_name,
          department: formData.department,
          job_title: formData.job_title,
          employee_id: formData.employee_id,
          avatar_url: avatarUrl,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to update profile")
      }

      setSuccess(true)
      setUser((prev: any) => ({ ...prev, ...data.profile }))
      setProfilePhoto(null)
      setPhotoPreview(null)

      setTimeout(() => setSuccess(false), 3000)
    } catch (err: any) {
      setError(err.message || "Failed to update profile")
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation user={user} />
        <main className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
              <p className="mt-2 text-muted-foreground">Loading profile...</p>
            </div>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation user={user} />

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto space-y-8">
          {/* Header */}
          <div className="space-y-2">
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
              <User className="h-8 w-8 text-primary" />
              Profile Settings
            </h1>
            <p className="text-muted-foreground">
              Manage your personal information and view your sustainability stats.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Profile Form */}
            <div className="lg:col-span-2 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Personal Information</CardTitle>
                  <CardDescription>Update your profile details and employment information</CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSave} className="space-y-6">
                    <div className="space-y-4">
                      <div className="flex items-center gap-4">
                        <Avatar className="h-20 w-20">
                          <AvatarImage src={photoPreview || user?.avatar_url || "/placeholder.svg"} />
                          <AvatarFallback className="text-lg">
                            {formData.first_name?.[0]}
                            {formData.last_name?.[0]}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <h3 className="font-medium">Profile Picture</h3>
                          <p className="text-sm text-muted-foreground">
                            Upload a profile photo to personalize your account
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <Input
                            type="file"
                            accept="image/*"
                            onChange={handlePhotoChange}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            disabled={isUploadingPhoto}
                          />
                          <Button type="button" variant="outline" disabled={isUploadingPhoto}>
                            <Camera className="h-4 w-4 mr-2" />
                            {isUploadingPhoto ? "Uploading..." : "Choose Photo"}
                          </Button>
                        </div>

                        {photoPreview && (
                          <Button
                            type="button"
                            variant="ghost"
                            onClick={() => {
                              setProfilePhoto(null)
                              setPhotoPreview(null)
                            }}
                          >
                            Remove
                          </Button>
                        )}
                      </div>

                      <p className="text-xs text-muted-foreground">
                        Supported formats: JPEG, PNG, WebP, GIF. Max size: 5MB
                      </p>
                    </div>

                    {/* Name Fields */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="firstName">First Name</Label>
                        <Input
                          id="firstName"
                          value={formData.first_name}
                          onChange={(e) => handleInputChange("first_name", e.target.value)}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="lastName">Last Name</Label>
                        <Input
                          id="lastName"
                          value={formData.last_name}
                          onChange={(e) => handleInputChange("last_name", e.target.value)}
                          required
                        />
                      </div>
                    </div>

                    {/* Email */}
                    <div className="space-y-2">
                      <Label htmlFor="email">Email Address</Label>
                      <Input id="email" type="email" value={formData.email} disabled className="bg-muted" />
                      <p className="text-xs text-muted-foreground">Email cannot be changed from this page</p>
                    </div>

                    {/* Employment Details */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="employeeId">Employee ID</Label>
                        <Input
                          id="employeeId"
                          value={formData.employee_id}
                          onChange={(e) => handleInputChange("employee_id", e.target.value)}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="department">Department</Label>
                        <Select
                          value={formData.department}
                          onValueChange={(value) => handleInputChange("department", value)}
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
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="jobTitle">Job Title</Label>
                      <Input
                        id="jobTitle"
                        value={formData.job_title}
                        onChange={(e) => handleInputChange("job_title", e.target.value)}
                        required
                      />
                    </div>

                    {error && (
                      <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>{error}</AlertDescription>
                      </Alert>
                    )}

                    {success && (
                      <Alert className="border-green-200 bg-green-50">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        <AlertDescription className="text-green-800">Profile updated successfully!</AlertDescription>
                      </Alert>
                    )}

                    <Button type="submit" disabled={isSaving || isUploadingPhoto} className="w-full md:w-auto">
                      <Save className="h-4 w-4 mr-2" />
                      {isSaving ? "Saving..." : "Save Changes"}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </div>

            {/* Stats Sidebar */}
            <div className="space-y-6">
              {/* Current Stats */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Award className="h-5 w-5 text-primary" />
                    Your Stats
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-2 bg-primary/10 rounded-lg">
                        <Award className="h-4 w-4 text-primary" />
                      </div>
                      <span className="text-sm font-medium">Total Points</span>
                    </div>
                    <Badge variant="secondary">{user?.points || 0}</Badge>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-2 bg-accent/10 rounded-lg">
                        <Leaf className="h-4 w-4 text-accent" />
                      </div>
                      <span className="text-sm font-medium">CO₂ Saved</span>
                    </div>
                    <Badge variant="secondary">{user?.total_co2_saved || 0}kg</Badge>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-2 bg-blue-100 rounded-lg">
                        <Target className="h-4 w-4 text-blue-600" />
                      </div>
                      <span className="text-sm font-medium">Level</span>
                    </div>
                    <Badge variant="secondary">{user?.level || 1}</Badge>
                  </div>
                </CardContent>
              </Card>

              {/* Activity Summary */}
              <Card>
                <CardHeader>
                  <CardTitle>Activity Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Total Actions</span>
                    <span className="font-medium">{stats?.totalActions || 0}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">This Week</span>
                    <span className="font-medium">{stats?.thisWeekActions || 0}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Badges Earned</span>
                    <span className="font-medium">{stats?.totalBadges || 0}</span>
                  </div>
                </CardContent>
              </Card>

              {/* Account Info */}
              <Card>
                <CardHeader>
                  <CardTitle>Account Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div>
                    <span className="text-muted-foreground">Member since</span>
                    <p className="font-medium">
                      {user?.created_at ? new Date(user.created_at).toLocaleDateString() : "N/A"}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Last updated</span>
                    <p className="font-medium">
                      {user?.updated_at ? new Date(user.updated_at).toLocaleDateString() : "N/A"}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
