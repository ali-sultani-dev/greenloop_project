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
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Users, ArrowLeft, AlertCircle, CheckCircle } from "lucide-react"
import Link from "next/link"

export default function CreateTeamPage() {
  const [user, setUser] = useState<any>(null)
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    maxMembers: "10",
  })
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [teamCreationEnabled, setTeamCreationEnabled] = useState(true)
  const [systemMaxTeamSize, setSystemMaxTeamSize] = useState(10)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function loadUser() {
      try {
        const { data: userData, error: userError } = await supabase.auth.getUser()
        if (userError || !userData?.user) {
          router.push("/auth/login")
          return
        }

        const { data: userProfile } = await supabase.from("users").select("*").eq("id", userData.user.id).single()

        setUser(userProfile)

        const { data: teamCreationSetting } = await supabase
          .from("system_settings")
          .select("setting_value")
          .eq("key", "team_creation_enabled")
          .single()
        const { data: maxTeamSizeSetting } = await supabase
          .from("system_settings")
          .select("setting_value")
          .eq("key", "max_team_size")
          .single()

        const creationEnabled = teamCreationSetting?.setting_value === "true"
        const maxTeamSize = Number.parseInt(maxTeamSizeSetting?.setting_value || "10")

        setTeamCreationEnabled(creationEnabled)
        setSystemMaxTeamSize(maxTeamSize)

        if (!creationEnabled && !userProfile?.is_admin) {
          router.push("/teams")
          return
        }

        // Users should be allowed to create teams even if they're already in other teams
      } catch (err) {
        setError("Failed to load user data")
      } finally {
        setIsLoading(false)
      }
    }

    loadUser()
  }, [router, supabase])

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return

    setIsSubmitting(true)
    setError(null)

    try {
      const maxMembers = Math.min(Number.parseInt(formData.maxMembers), systemMaxTeamSize)

      const { data: newTeam, error: teamError } = await supabase
        .from("teams")
        .insert({
          name: formData.name,
          description: formData.description,
          team_leader_id: user.id,
          max_members: maxMembers,
        })
        .select()
        .single()

      if (teamError) throw teamError

      const { data: existingMembership } = await supabase
        .from("team_members")
        .select("id")
        .eq("team_id", newTeam.id)
        .eq("user_id", user.id)
        .single()

      if (!existingMembership) {
        const { error: memberError } = await supabase.from("team_members").insert({
          team_id: newTeam.id,
          user_id: user.id,
          role: "leader",
        })

        if (memberError) throw memberError
      }

      router.push(`/teams/${newTeam.id}`)
    } catch (err: any) {
      if (err.message?.includes("duplicate key value violates unique constraint")) {
        setError("You are already a member of this team. Redirecting...")
        setTimeout(() => router.push("/teams"), 2000)
      } else {
        setError(err.message || "Failed to create team")
      }
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
              <p className="mt-2 text-muted-foreground">Loading...</p>
            </div>
          </div>
        </main>
      </div>
    )
  }

  if (!teamCreationEnabled && !user?.is_admin) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation user={user} />
        <main className="container mx-auto px-4 py-8">
          <div className="max-w-2xl mx-auto">
            <Card>
              <CardContent className="text-center py-8">
                <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <h3 className="font-medium mb-2">Team Creation Disabled</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Team creation is currently disabled. Contact your administrator for assistance.
                </p>
                <Button asChild>
                  <Link href="/teams">Back to Teams</Link>
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
          <Button variant="ghost" asChild className="mb-4">
            <Link href="/teams">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Teams
            </Link>
          </Button>

          <div className="space-y-2">
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
              <Users className="h-8 w-8 text-primary" />
              Create New Team
            </h1>
            <p className="text-muted-foreground">
              Start a sustainability team to collaborate with colleagues and amplify your environmental impact.
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Team Details</CardTitle>
              <CardDescription>Provide information about your new sustainability team</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="name">Team Name *</Label>
                  <Input
                    id="name"
                    placeholder="e.g., Green Warriors, Eco Champions"
                    value={formData.name}
                    onChange={(e) => handleInputChange("name", e.target.value)}
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    Choose a memorable name that reflects your team's mission
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description *</Label>
                  <Textarea
                    id="description"
                    placeholder="Describe your team's goals and what you hope to achieve together..."
                    value={formData.description}
                    onChange={(e) => handleInputChange("description", e.target.value)}
                    rows={4}
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    Help others understand your team's purpose and sustainability focus
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="maxMembers">Maximum Members</Label>
                  <Input
                    id="maxMembers"
                    type="number"
                    min="2"
                    max={systemMaxTeamSize}
                    value={formData.maxMembers}
                    onChange={(e) => handleInputChange("maxMembers", e.target.value)}
                    placeholder={`Enter number (max ${systemMaxTeamSize})`}
                  />
                  <p className="text-xs text-muted-foreground">
                    You can always adjust this later. Maximum allowed: {systemMaxTeamSize} members. Smaller teams often
                    have better collaboration.
                  </p>
                </div>

                {error && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <div className="flex gap-3">
                  <Button type="submit" disabled={isSubmitting} className="flex-1">
                    {isSubmitting ? "Creating Team..." : "Create Team"}
                  </Button>
                  <Button type="button" variant="outline" asChild>
                    <Link href="/teams">Cancel</Link>
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">What happens next?</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-start gap-3">
                <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                <div>
                  <p className="font-medium">You become the team leader</p>
                  <p className="text-sm text-muted-foreground">
                    You'll be able to invite members, manage the team, and create team challenges
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                <div>
                  <p className="font-medium">Invite colleagues</p>
                  <p className="text-sm text-muted-foreground">
                    Share your team with coworkers to start building your sustainability community
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                <div>
                  <p className="font-medium">Start collaborating</p>
                  <p className="text-sm text-muted-foreground">
                    Create challenges, track progress, and celebrate achievements together
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
