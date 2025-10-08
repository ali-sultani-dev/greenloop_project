"use client"
import { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { createClient } from "@/lib/supabase/client"
import { adminChallengeSchema, type AdminChallengeData } from "@/lib/validations/challenge"
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
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { useToast } from "@/hooks/use-toast"
import { Loader2 } from "lucide-react"

interface Challenge {
  id?: string
  title: string
  description: string
  category: string
  challenge_type: string
  start_date: string
  end_date: string
  target_metric?: string
  target_value?: number
  reward_points?: number
  reward_description?: string
  max_participants?: number
  is_active: boolean
}

interface Team {
  id: string
  name: string
  description?: string
  total_points?: number
}

interface ChallengeCrudModalProps {
  isOpen: boolean
  onClose: () => void
  challenge?: Challenge | null
  onSuccess: () => void
  currentAdminId?: string
}

export function ChallengeCrudModal({ isOpen, onClose, challenge, onSuccess, currentAdminId }: ChallengeCrudModalProps) {
  const [isDeleting, setIsDeleting] = useState(false)
  const [teams, setTeams] = useState<Team[]>([])
  const [loadingTeams, setLoadingTeams] = useState(false)
  const { toast } = useToast()
  const supabase = createClient()

  const form = useForm<AdminChallengeData>({
    resolver: zodResolver(adminChallengeSchema),
    defaultValues: {
      title: "",
      description: "",
      challengeType: "individual",
      category: "general",
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      targetMetric: "actions",
      targetValue: 10,
      rewardPoints: 0,
      rewardDescription: "",
      maxParticipants: undefined,
      isActive: true,
    },
  })

  const {
    formState: { isSubmitting },
    watch,
  } = form

  const challengeType = watch("challengeType")

  useEffect(() => {
    async function fetchTeams() {
      if (!isOpen || challengeType !== "team") return

      setLoadingTeams(true)
      try {
        const response = await fetch("/api/teams")
        if (response.ok) {
          const data = await response.json()
          setTeams(data.teams || [])
        }
      } catch (error) {
        console.error("Failed to fetch teams:", error)
      } finally {
        setLoadingTeams(false)
      }
    }

    fetchTeams()
  }, [isOpen, challengeType])

  useEffect(() => {
    if (isOpen && challenge) {
      console.log("-> Challenge modal opened with data:", challenge)

      const formatDateForInput = (dateString: string) => {
        if (!dateString) return new Date().toISOString().split("T")[0]
        const date = new Date(dateString)
        return date.toISOString().split("T")[0]
      }

      form.reset({
        title: challenge.title || "",
        description: challenge.description || "",
        category: (challenge.category as any) || "general",
        challengeType: (challenge.challenge_type as any) || "individual",
        endDate: challenge.end_date
          ? formatDateForInput(challenge.end_date)
          : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
        targetMetric: (challenge.target_metric as any) || "actions",
        targetValue: challenge.target_value || 10,
        rewardPoints: challenge.challenge_type === "individual" ? 0 : challenge.reward_points || 100,
        rewardDescription: challenge.reward_description || "",
        maxParticipants: challenge.challenge_type === "individual" ? 1 : challenge.max_participants || undefined,
        isActive: challenge.is_active ?? true,
      })
    } else if (isOpen && !challenge) {
      form.reset()
    }
  }, [isOpen, challenge, form])

  const logAdminActivity = async (action: string, targetId: string, details: any) => {
    if (!currentAdminId) return

    try {
      await supabase.rpc("log_admin_activity", {
        p_admin_user_id: currentAdminId,
        p_action: action,
        p_resource_type: "challenges",
        p_resource_id: targetId,
        p_details: details,
      })
    } catch (error) {
      console.error("Failed to log admin activity:", error)
    }
  }

  const onSubmit = async (data: AdminChallengeData) => {
    try {
      const challengeData = {
        title: data.title,
        description: data.description,
        category: data.category,
        challenge_type: data.challengeType,
        ...(challenge?.id ? {} : { start_date: new Date().toISOString() }),
        end_date: data.endDate,
        target_metric: data.targetMetric,
        target_value: data.targetValue,
        reward_points: data.challengeType === "individual" ? 0 : data.rewardPoints,
        reward_description: data.rewardDescription,
        max_participants: data.challengeType === "individual" ? 1 : data.maxParticipants,
        is_active: data.isActive,
      }

      if (challenge?.id) {
        const { error } = await supabase.from("challenges").update(challengeData).eq("id", challenge.id)

        if (error) throw error

        if (data.challengeType === "team" && data.teamId) {
          await supabase.from("challenge_participants").delete().eq("challenge_id", challenge.id)

          const { data: teamMembers } = await supabase.from("team_members").select("user_id").eq("team_id", data.teamId)

          if (teamMembers && teamMembers.length > 0) {
            const participants = teamMembers.map((member) => ({
              challenge_id: challenge.id,
              user_id: null,
              team_id: data.teamId,
            }))

            await supabase.from("challenge_participants").insert(participants)
          }
        }

        await logAdminActivity("challenge_updated", challenge.id, {
          title: data.title,
          challenge_type: data.challengeType,
          is_active: data.isActive,
        })

        toast({
          title: "Success",
          description: "Challenge updated successfully",
        })
      } else {
        const { data: userData } = await supabase.auth.getUser()
        const { data: newChallenge, error } = await supabase
          .from("challenges")
          .insert([
            {
              ...challengeData,
              created_by: currentAdminId || userData.user?.id,
            },
          ])
          .select()
          .single()

        if (error) throw error

        if (newChallenge && data.challengeType === "team" && data.teamId) {
          const { data: teamMembers } = await supabase.from("team_members").select("user_id").eq("team_id", data.teamId)

          if (teamMembers && teamMembers.length > 0) {
            const participants = teamMembers.map((member) => ({
              challenge_id: newChallenge.id,
              user_id: null,
              team_id: data.teamId,
            }))

            await supabase.from("challenge_participants").insert(participants)
          }
        }

        if (newChallenge) {
          await logAdminActivity("challenge_created", newChallenge.id, {
            title: data.title,
            challenge_type: data.challengeType,
            category: data.category,
          })
        }

        toast({
          title: "Success",
          description: "Challenge created successfully",
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
    }
  }

  const handleDelete = async () => {
    if (!challenge?.id) return

    setIsDeleting(true)
    try {
      const { error } = await supabase.from("challenges").delete().eq("id", challenge.id)

      if (error) throw error

      await logAdminActivity("challenge_deleted", challenge.id, {
        title: challenge.title,
        challenge_type: challenge.challenge_type,
      })

      toast({
        title: "Success",
        description: "Challenge deleted successfully",
      })

      onSuccess()
      onClose()
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete challenge",
        variant: "destructive",
      })
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{challenge?.id ? "Edit Challenge" : "Create New Challenge"}</DialogTitle>
          <DialogDescription>
            {challenge?.id
              ? "Update challenge information and settings."
              : "Create a new sustainability challenge for users."}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Challenge Title</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea {...field} rows={3} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
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
                name="challengeType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Type</FormLabel>
                    <Select
                      onValueChange={(value) => {
                        field.onChange(value)
                        if (value === "individual") {
                          form.setValue("rewardPoints", 0)
                          form.setValue("maxParticipants", 1)
                        } else {
                          form.setValue("rewardPoints", 100)
                          form.setValue("maxParticipants", undefined)
                        }
                      }}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="individual">Individual (Personal)</SelectItem>
                        <SelectItem value="team">Team</SelectItem>
                        <SelectItem value="company">Company-wide</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="endDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>End Date</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="targetMetric"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Target Metric</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
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
                    <FormLabel>Target Value</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="0"
                        {...field}
                        onChange={(e) => field.onChange(Number(e.target.value) || 0)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="rewardPoints"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Reward Points</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="0"
                        disabled={challengeType === "individual"}
                        placeholder={challengeType === "individual" ? "0 (Personal)" : "Enter points"}
                        {...field}
                        value={challengeType === "individual" ? 0 : field.value}
                        onChange={(e) =>
                          field.onChange(challengeType === "individual" ? 0 : Number(e.target.value) || 0)
                        }
                      />
                    </FormControl>
                    {challengeType === "individual" && (
                      <FormDescription className="text-xs text-muted-foreground">
                        Personal challenges cannot have reward points
                      </FormDescription>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="rewardDescription"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Reward Description</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Green Champion Badge" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="maxParticipants"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Maximum Participants</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="1"
                        disabled={challengeType === "individual"}
                        placeholder={challengeType === "individual" ? "1 (Personal)" : "Leave empty for unlimited"}
                        {...field}
                        value={challengeType === "individual" ? 1 : field.value || ""}
                        onChange={(e) =>
                          field.onChange(
                            challengeType === "individual" ? 1 : e.target.value ? Number(e.target.value) : undefined,
                          )
                        }
                      />
                    </FormControl>
                    {challengeType === "individual" && (
                      <FormDescription className="text-xs text-muted-foreground">
                        Personal challenges are limited to 1 participant (yourself)
                      </FormDescription>
                    )}
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
                    <FormLabel>Select Team</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value} disabled={loadingTeams}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={loadingTeams ? "Loading teams..." : "Select a team"} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {teams.map((team) => (
                          <SelectItem key={team.id} value={team.id}>
                            {team.name} {team.total_points ? `(${team.total_points} pts)` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>Choose which team this challenge is for</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="isActive"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Active Status</FormLabel>
                    <FormDescription>Challenge is active and accepting participants</FormDescription>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />

            <DialogFooter className="gap-2">
              {challenge?.id && (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={handleDelete}
                  disabled={isDeleting || isSubmitting}
                >
                  {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete"}
                </Button>
              )}
              <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting || isDeleting}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting || isDeleting}>
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : challenge?.id ? "Update" : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
