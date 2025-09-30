"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Navigation } from "@/components/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Target, Award, Leaf, Clock, Camera, CheckCircle, AlertCircle, ArrowLeft, X } from "lucide-react"
import Link from "next/link"

interface ActionLogPageProps {
  params: {
    id: string
  }
}

export default function ActionLogPage({ params }: ActionLogPageProps) {
  const [action, setAction] = useState<any>(null)
  const [user, setUser] = useState<any>(null)
  const [notes, setNotes] = useState("")
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [previewUrls, setPreviewUrls] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function loadData() {
      try {
        // Get current user
        const { data: userData, error: userError } = await supabase.auth.getUser()
        if (userError || !userData?.user) {
          router.push("/auth/login")
          return
        }

        // Get user profile
        const { data: userProfile } = await supabase.from("users").select("*").eq("id", userData.user.id).single()

        setUser(userProfile)

        // Get action details
        const { data: actionData, error: actionError } = await supabase
          .from("sustainability_actions")
          .select(`
            *,
            action_categories (*)
          `)
          .eq("id", params.id)
          .single()

        if (actionError) {
          setError("Action not found")
          return
        }

        setAction(actionData)
      } catch (err) {
        setError("Failed to load action details")
      } finally {
        setIsLoading(false)
      }
    }

    loadData()
  }, [params.id, router, supabase])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    const imageFiles = files.filter((file) => file.type.startsWith("image/"))

    if (imageFiles.length !== files.length) {
      setError("Only image files are allowed")
      return
    }

    if (selectedFiles.length + imageFiles.length > 3) {
      setError("Maximum 3 photos allowed")
      return
    }

    setSelectedFiles((prev) => [...prev, ...imageFiles])

    // Create preview URLs
    imageFiles.forEach((file) => {
      const url = URL.createObjectURL(file)
      setPreviewUrls((prev) => [...prev, url])
    })
  }

  const removeFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index))
    URL.revokeObjectURL(previewUrls[index])
    setPreviewUrls((prev) => prev.filter((_, i) => i !== index))
  }

  // Clean up preview URLs on unmount
  useEffect(() => {
    return () => {
      previewUrls.forEach((url) => URL.revokeObjectURL(url))
    }
  }, [previewUrls])

  const uploadPhotos = async () => {
    if (selectedFiles.length === 0) return []

    const uploadPromises = selectedFiles.map(async (file, index) => {
      const fileExt = file.name.split(".").pop()
      const fileName = `${user.id}/${Date.now()}_${Math.random().toString(36).substring(2)}_${index}.${fileExt}`
      const filePath = fileName

      console.log("-> Uploading file:", { fileName, filePath, fileSize: file.size })

      const { error: uploadError, data: uploadData } = await supabase.storage
        .from("action-photos")
        .upload(filePath, file)

      console.log("-> Upload result:", { uploadError, uploadData })

      if (uploadError) {
        console.error("-> Upload failed:", uploadError)
        throw new Error(`Failed to upload photo: ${uploadError.message}`)
      }

      const { data: urlData } = supabase.storage.from("action-photos").getPublicUrl(filePath)
      console.log("-> Public URL data:", urlData)

      return urlData.publicUrl
    })

    return Promise.all(uploadPromises)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!action || !user) return

    if (selectedFiles.length === 0) {
      setError("Photo proof is required for all actions")
      return
    }

    if (action.verification_required && !notes.trim()) {
      setError("Notes are required for actions that need verification")
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      console.log("-> Starting photo upload before API call...")
      let photoUrls: string[] = []

      try {
        photoUrls = await uploadPhotos()
        console.log("-> Photos uploaded successfully:", photoUrls)
      } catch (photoError) {
        console.error("-> Photo upload failed:", photoError)
        setError("Failed to upload photos. Please try again.")
        return
      }

      const response = await fetch("/api/actions/log", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action_id: action.id,
          notes: notes.trim() || null,
          has_photos: photoUrls.length > 0,
          photo_url: photoUrls[0] || null, // Include photo URL in initial request
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || "Failed to log action")
      }

      console.log("-> Action logged successfully with photos")

      setSuccess(true)

      // Redirect after success
      setTimeout(() => {
        router.push("/dashboard")
      }, 2000)
    } catch (err: any) {
      setError(err.message || "Failed to log action")
    } finally {
      setIsSubmitting(false)
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
              <p className="mt-2 text-muted-foreground">Loading action details...</p>
            </div>
          </div>
        </main>
      </div>
    )
  }

  if (error && !action) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation user={user} />
        <main className="container mx-auto px-4 py-8">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </main>
      </div>
    )
  }

  if (success) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation user={user} />
        <main className="container mx-auto px-4 py-8">
          <div className="max-w-md mx-auto">
            <Card className="text-center">
              <CardHeader>
                <div className="mx-auto p-3 bg-green-100 rounded-full w-fit mb-4">
                  <CheckCircle className="h-8 w-8 text-green-600" />
                </div>
                <CardTitle className="text-xl">Action Logged Successfully!</CardTitle>
                <CardDescription>
                  Your action has been submitted for review. Upon approval, you'll earn {action.points_value} points and
                  save {action.co2_impact}kg of CO₂
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  An admin will review your submission and verify the completed action. Points will be added to your
                  account once approved.
                </p>
                <Button asChild className="w-full">
                  <Link href="/dashboard">Return to Dashboard</Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation user={user} />

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto space-y-6">
          {/* Back Button */}
          <Button variant="ghost" asChild className="mb-4">
            <Link href="/actions">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Actions
            </Link>
          </Button>

          {/* Action Details */}
          <Card>
            <CardHeader>
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-lg" style={{ backgroundColor: `${action.action_categories?.color}20` }}>
                  <Target className="h-6 w-6" style={{ color: action.action_categories?.color }} />
                </div>
                <div className="flex-1">
                  <CardTitle className="text-2xl">{action.title}</CardTitle>
                  <CardDescription className="mt-2 text-base">{action.description}</CardDescription>
                  <div className="flex items-center gap-4 mt-4">
                    <Badge variant="outline">{action.action_categories?.name}</Badge>
                    <div className="flex items-center gap-1 text-sm">
                      <Award className="h-4 w-4 text-primary" />
                      <span className="font-medium text-primary">+{action.points_value} points</span>
                    </div>
                    <div className="flex items-center gap-1 text-sm">
                      <Leaf className="h-4 w-4 text-accent" />
                      <span className="text-accent">{action.co2_impact}kg CO₂ saved</span>
                    </div>
                    {action.estimated_time_minutes && (
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Clock className="h-4 w-4" />
                        <span>~{action.estimated_time_minutes} min</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </CardHeader>
          </Card>

          {/* Instructions */}
          {action.instructions && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Instructions</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-relaxed whitespace-pre-line">{action.instructions}</p>
              </CardContent>
            </Card>
          )}

          {/* Verification Notice */}
          {action.verification_required && (
            <Alert>
              <Camera className="h-4 w-4" />
              <AlertDescription>
                This action requires verification. Please provide detailed notes and photos about how you completed this
                action. An admin will review your submission.
              </AlertDescription>
            </Alert>
          )}

          <Alert>
            <Camera className="h-4 w-4" />
            <AlertDescription>
              <strong>Photo proof is required</strong> for all sustainability actions to ensure authenticity and proper
              verification.
            </AlertDescription>
          </Alert>

          {/* Log Form */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Log This Action</CardTitle>
              <CardDescription>Confirm that you've completed this sustainability action</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="notes">
                    Notes {action.verification_required && <span className="text-destructive">*</span>}
                  </Label>
                  <Textarea
                    id="notes"
                    placeholder={
                      action.verification_required
                        ? "Please describe how you completed this action (required for verification)"
                        : "Add any notes about completing this action (optional)"
                    }
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    required={action.verification_required}
                    rows={4}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="photos">
                    Photos <span className="text-destructive">*</span>
                    <span className="text-sm text-muted-foreground ml-2">Required - Max 3 photos</span>
                  </Label>
                  <div className="space-y-4">
                    <Input
                      id="photos"
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleFileSelect}
                      className="cursor-pointer"
                      required
                    />

                    {previewUrls.length > 0 && (
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        {previewUrls.map((url, index) => (
                          <div key={index} className="relative">
                            <img
                              src={url || "/placeholder.svg"}
                              alt={`Preview ${index + 1}`}
                              className="w-full h-32 object-cover rounded-lg border"
                            />
                            <Button
                              type="button"
                              variant="destructive"
                              size="sm"
                              className="absolute top-2 right-2 h-6 w-6 p-0"
                              onClick={() => removeFile(index)}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {error && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <div className="flex gap-3">
                  <Button
                    type="submit"
                    disabled={
                      isSubmitting || (action.verification_required && !notes.trim()) || selectedFiles.length === 0 // Disable submit if no photos
                    }
                    className="flex-1"
                  >
                    {isSubmitting ? "Logging Action..." : "Log Action"}
                  </Button>
                  <Button type="button" variant="outline" asChild>
                    <Link href="/actions">Cancel</Link>
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
