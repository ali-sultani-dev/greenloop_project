"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { createClient } from "@/lib/supabase/client"
import { challengeFormSchema, type ChallengeFormData } from "@/lib/validations/challenge"
import { Navigation } from "@/components/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { CalendarIcon, Trophy, Target, ArrowLeft, AlertCircle, CheckCircle } from "lucide-react"
import Link from "next/link"

export default function CreateChallengePage() {
  const [user, setUser] = useState<any>(null)
  const [userTeams, setUserTeams] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [success, setSuccess] = useState(false)
  const [challengeCreationEnabled, setChallengeCreationEnabled] = useState(true)

  const router = useRouter()
  const supabase = createClient()

  const form = useForm<ChallengeFormData>({
    resolver: zodResolver(challengeFormSchema),
    defaultValues: {
      title: "",
      description: "",
      challengeType: "individual",
      category: "general",
      endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      targetMetric: "actions",
      targetValue: 10,
      rewardPoints: 0,
      rewardDescription: "",
      maxParticipants: 1,
      teamId: undefined,
    },
  })

  const {
    watch,
    formState: { errors, isSubmitting },
  } = form
  const challengeType = watch("challengeType")

  useEffect(() => {
    async function loadData() {
      try {
        const { data: userData, error: userError } = await supabase.auth.getUser()
        if (userError || !userData?.user) {
          router.push("/auth/login")
          return
        }

        // Get user profile
        const { data: userProfile } = await supabase.from("users").select("*").eq("id", userData.user.id).single()
        setUser(userProfile)

        const { data: challengeCreationSetting } = await supabase
          .from("system_settings")
          .select("setting_value")
          .eq("key", "challenge_creation_enabled")
          .single()

        const creationEnabled = challengeCreationSetting?.setting_value === "true"
        setChallengeCreationEnabled(creationEnabled)

        if (!creationEnabled && !userProfile?.is_admin) {
          router.push("/challenges")
          return
        }

        const teamsQuery = supabase.from("admin_team_stats").select("id, name, current_members").eq("is_active", true)

        // If user is admin, fetch all teams; otherwise, fetch only user's teams
        if (userProfile?.is_admin) {
          // Admin can see all teams
          const { data: allTeams } = await teamsQuery
          setUserTeams(allTeams || [])
        } else {
          // Regular users see only their teams
          const { data: userTeamMemberships } = await supabase
            .from("team_members")
            .select(`
              team_id,
              teams!inner (
                id, 
                name,
                is_active
              )
            `)
            .eq("user_id", userData.user.id)
            .eq("teams.is_active", true)

          // Get the team IDs the user is part of
          const userTeamIds = userTeamMemberships?.map((tm) => tm.team_id) || []
          if (userTeamIds.length > 0) {
            // Fetch team stats for user's teams
            const { data: userTeams } = await supabase
              .from("admin_team_stats")
              .select("id, name, current_members")
              .in("id", userTeamIds)
              .eq("is_active", true)

            setUserTeams(userTeams || [])
          } else {
            setUserTeams([])
          }
        }
      } catch (err) {
        console.error("Failed to load data:", err)
      } finally {
        setIsLoading(false)
      }
    }

    loadData()
  }, [router, supabase])

  const getAvailableChallengeTypes = () => {
    const types = [{ value: "individual", label: "Personal Challenge" }]

    // Add team challenges if user is part of any team
    if (userTeams.length > 0) {
      types.push({ value: "team", label: "Team Challenge" })
    }

    // Add company-wide challenges if user is admin
    if (user?.is_admin) {
      types.push({ value: "company", label: "Company-wide Challenge" })
    }

    return types
  }

  const onSubmit = async (data: ChallengeFormData) => {
    if (!user) return

    try {
      const challengeData = {
        title: data.title.trim(),
        description: data.description.trim(),
        challengeType: data.challengeType,
        category: data.category,
        endDate: data.endDate,
        rewardPoints: data.rewardPoints,
        targetMetric: data.targetMetric,
        targetValue: data.targetValue,
        rewardDescription: data.rewardDescription,
        maxParticipants: data.maxParticipants,
        teamId: data.challengeType === "team" ? data.teamId : undefined,
      }

      const response = await fetch("/api/challenges", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(challengeData),
      })

      const result = await response.json()
      if (!response.ok) {
        if (result.details) {
          // Handle validation errors from server
          Object.entries(result.details).forEach(([field, messages]) => {
            form.setError(field as keyof ChallengeFormData, {
              message: Array.isArray(messages) ? messages[0] : (messages as string),
            })
          })
          return
        }
        throw new Error(result.error || "Failed to create challenge")
      }

      setSuccess(true)

      setTimeout(() => {
        router.push("/challenges")
      }, 2000)
    } catch (err: any) {
      console.error("Submit error:", err)
      form.setError("root", {
        message: err.message || "Failed to create challenge",
      })
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

  if (!challengeCreationEnabled && !user?.is_admin) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation user={user} />
        <main className="container mx-auto px-4 py-8">
          <div className="max-w-2xl mx-auto">
            <Card>
              <CardContent className="text-center py-8">
                <Trophy className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <h3 className="font-medium mb-2">Challenge Creation Disabled</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Challenge creation is currently disabled. Contact your administrator for assistance.
                </p>
                <Button asChild>
                  <Link href="/challenges">Back to Challenges</Link>
                </Button>
              </CardContent>
            </Card>
          </div>
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
                <CardTitle className="text-xl">Challenge Created Successfully!</CardTitle>
                <CardDescription>
                  Your challenge has been created and is now available for participants to join.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild className="w-full">
                  <Link href="/challenges">View All Challenges</Link>
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

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="space-y-6">
          {/* Back Button */}
          <Button variant="ghost" asChild className="mb-4">
            <Link href="/challenges">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Challenges
            </Link>
          </Button>

          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-balance mb-2 flex items-center gap-3">
              <Trophy className="h-8 w-8 text-primary" />
              Create New Challenge
            </h1>
            <p className="text-muted-foreground text-pretty">
              Design a sustainability challenge to engage participants and drive positive environmental impact.
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="h-5 w-5 text-primary" />
                Challenge Details
              </CardTitle>
              <CardDescription>Set up your challenge parameters and goals</CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                      control={form.control}
                      name="title"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            Challenge Title <span className="text-destructive">*</span>
                          </FormLabel>
                          <FormControl>
                            <Input placeholder="e.g., Zero Waste Week Challenge" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="challengeType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            Challenge Type <span className="text-destructive">*</span>
                          </FormLabel>
                          <Select
                            onValueChange={async (value) => {
                              field.onChange(value)
                              if (value === "individual") {
                                form.setValue("maxParticipants", 1)
                                form.setValue("rewardPoints", 0)
                                form.setValue("teamId", undefined)
                              } else if (value === "team") {
                                const selectedTeamId = form.getValues("teamId")
                                if (selectedTeamId) {
                                  const selectedTeam = userTeams.find((team) => team.id === selectedTeamId)
                                  const teamMemberCount = selectedTeam?.current_members || 0
                                  form.setValue("maxParticipants", teamMemberCount)
                                }
                                form.setValue("rewardPoints", 100)
                              } else {
                                form.setValue("maxParticipants", undefined)
                                form.setValue("rewardPoints", 100)
                              }
                            }}
                            value={field.value}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select challenge type" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {getAvailableChallengeTypes().map((type) => (
                                <SelectItem key={type.value} value={type.value}>
                                  {type.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {challengeType === "team" && (
                    <FormField
                      control={form.control}
                      name="teamId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            Select Team <span className="text-destructive">*</span>
                          </FormLabel>
                          <Select
                            onValueChange={(value) => {
                              field.onChange(value)
                              const selectedTeam = userTeams.find((team) => team.id === value)
                              const teamMemberCount = selectedTeam?.current_members || 0
                              form.setValue("maxParticipants", teamMemberCount)
                            }}
                            value={field.value}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select a team" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {userTeams.map((team) => (
                                <SelectItem key={team.id} value={team.id}>
                                  {team.name} ({team.current_members || 0} members)
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          Description <span className="text-destructive">*</span>
                        </FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Describe the challenge goals, rules, and expected outcomes..."
                            className="min-h-[100px]"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FormField
                      control={form.control}
                      name="endDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            End Date <span className="text-destructive">*</span>
                          </FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Input type="date" {...field} />
                              <CalendarIcon className="absolute right-3 top-3 h-4 w-4 text-muted-foreground pointer-events-none" />
                            </div>
                          </FormControl>
                          <FormDescription>Challenge will start immediately upon creation</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="rewardPoints"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            Points Reward <span className="text-destructive">*</span>
                          </FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min="0"
                              placeholder="100"
                              disabled={challengeType === "individual"}
                              {...field}
                              onChange={(e) => field.onChange(Number(e.target.value))}
                            />
                          </FormControl>
                          {challengeType === "individual" && (
                            <FormDescription className="text-muted-foreground">
                              Personal challenges cannot have reward points to prevent abuse
                            </FormDescription>
                          )}
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <FormField
                      control={form.control}
                      name="category"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            Category <span className="text-destructive">*</span>
                          </FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value?.toString()}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select category" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="Energy">Energy Conservation</SelectItem>
                              <SelectItem value="Waste Reduction">Waste Reduction</SelectItem>
                              <SelectItem value="Transportation">Sustainable Transport</SelectItem>
                              <SelectItem value="Water Conservation">Water Conservation</SelectItem>
                              <SelectItem value="Food & Diet">Food & Diet</SelectItem>
                              <SelectItem value="Office Practices">Office Practices</SelectItem>
                              <SelectItem value="Community">Community</SelectItem>
                              <SelectItem value="Digital">Digital</SelectItem>
                              <SelectItem value="general">General Sustainability</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="targetMetric"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            Target Metric <span className="text-destructive">*</span>
                          </FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value?.toString()}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select metric" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="actions">Actions Completed</SelectItem>
                              <SelectItem value="points">Points Earned</SelectItem>
                              <SelectItem value="co2_saved">CO2 Saved (kg)</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="targetValue"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            Target Value <span className="text-destructive">*</span>
                          </FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min="1"
                              placeholder="e.g., 10"
                              {...field}
                              onChange={(e) => field.onChange(Number(e.target.value))}
                            />
                          </FormControl>
                          <FormDescription>Enter a whole number (no decimals allowed)</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                      control={form.control}
                      name="rewardDescription"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Reward Description</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g., Green Champion Badge" {...field} />
                          </FormControl>
                          <FormDescription>Optional description of additional rewards</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="maxParticipants"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Max Participants</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min="1"
                              placeholder="Leave empty for unlimited"
                              disabled={challengeType === "individual" || challengeType === "team"}
                              {...field}
                              onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                            />
                          </FormControl>
                          {challengeType === "individual" && (
                            <FormDescription className="text-muted-foreground">
                              Personal challenges are limited to 1 participant (yourself)
                            </FormDescription>
                          )}
                          {challengeType === "team" && (
                            <FormDescription className="text-muted-foreground">
                              Team challenges automatically include all team members
                            </FormDescription>
                          )}
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {errors.root && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>{errors.root.message}</AlertDescription>
                    </Alert>
                  )}

                  <div className="flex gap-4 pt-6">
                    <Button type="submit" disabled={isSubmitting} className="flex-1">
                      <Target className="mr-2 h-4 w-4" />
                      {isSubmitting ? "Creating Challenge..." : "Create Challenge"}
                    </Button>
                    <Button type="button" variant="outline" asChild>
                      <Link href="/challenges">Cancel</Link>
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
