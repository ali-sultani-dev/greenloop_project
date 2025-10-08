"use client"

import { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { createBrowserClient } from "@supabase/ssr"
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

const rewardSchema = z.object({
  level: z.number().min(1).max(10),
  reward_title: z.string().min(1, "Title is required").max(255),
  reward_description: z.string().min(1, "Description is required"),
  reward_type: z.enum(["physical", "digital", "experience", "privilege"]),
  is_active: z.boolean(),
})

type RewardFormData = z.infer<typeof rewardSchema>

interface LevelReward {
  id: string
  level: number
  reward_title: string
  reward_description: string
  reward_type: "physical" | "digital" | "experience" | "privilege"
  is_active: boolean
  created_at: string
  updated_at: string
}

interface RewardCrudModalProps {
  isOpen: boolean
  onClose: () => void
  reward?: LevelReward | null
  onSuccess: () => void
}

export function RewardCrudModal({ isOpen, onClose, reward, onSuccess }: RewardCrudModalProps) {
  const [isDeleting, setIsDeleting] = useState(false)
  const { toast } = useToast()

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )

  const form = useForm<RewardFormData>({
    resolver: zodResolver(rewardSchema),
    defaultValues: {
      level: 1,
      reward_title: "",
      reward_description: "",
      reward_type: "physical",
      is_active: true,
    },
  })

  const {
    formState: { isSubmitting },
  } = form

  useEffect(() => {
    if (isOpen && reward) {
      form.reset({
        level: reward.level,
        reward_title: reward.reward_title,
        reward_description: reward.reward_description,
        reward_type: reward.reward_type,
        is_active: reward.is_active,
      })
    } else if (isOpen && !reward) {
      form.reset({
        level: 1,
        reward_title: "",
        reward_description: "",
        reward_type: "physical",
        is_active: true,
      })
    }
  }, [isOpen, reward, form])

  const onSubmit = async (data: RewardFormData) => {
    try {
      if (reward?.id) {
        // Update existing reward
        const { error } = await supabase
          .from("level_rewards")
          .update({
            level: data.level,
            reward_title: data.reward_title,
            reward_description: data.reward_description,
            reward_type: data.reward_type,
            is_active: data.is_active,
            updated_at: new Date().toISOString(),
          })
          .eq("id", reward.id)

        if (error) throw error

        toast({
          title: "Success",
          description: "Reward updated successfully",
        })
      } else {
        // Create new reward
        const { error } = await supabase.from("level_rewards").insert([
          {
            level: data.level,
            reward_title: data.reward_title,
            reward_description: data.reward_description,
            reward_type: data.reward_type,
            is_active: data.is_active,
          },
        ])

        if (error) throw error

        toast({
          title: "Success",
          description: "Reward created successfully",
        })
      }

      onSuccess()
      onClose()
    } catch (error: any) {
      console.error("Error saving reward:", error)
      toast({
        title: "Error",
        description: error.message || "Something went wrong",
        variant: "destructive",
      })
    }
  }

  const handleDelete = async () => {
    if (!reward?.id) return

    setIsDeleting(true)
    try {
      const { error } = await supabase.from("level_rewards").delete().eq("id", reward.id)

      if (error) throw error

      toast({
        title: "Success",
        description: "Reward deleted successfully",
      })

      onSuccess()
      onClose()
    } catch (error: any) {
      console.error("Error deleting reward:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to delete reward",
        variant: "destructive",
      })
    } finally {
      setIsDeleting(false)
    }
  }

  const getRewardTypeDescription = (type: string) => {
    switch (type) {
      case "physical":
        return "Physical items like eco-friendly products, branded merchandise"
      case "digital":
        return "Digital rewards like certificates, badges, or digital content"
      case "experience":
        return "Experiences like workshops, events, or special access"
      case "privilege":
        return "Special privileges like priority booking, exclusive access"
      default:
        return ""
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{reward?.id ? "Edit Reward" : "Create New Reward"}</DialogTitle>
          <DialogDescription>
            {reward?.id ? "Update reward information and settings." : "Create a new level reward for users to claim."}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="level"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Level</FormLabel>
                    <Select onValueChange={(value) => field.onChange(Number(value))} value={field.value.toString()}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select level" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {Array.from({ length: 10 }, (_, i) => i + 1).map((level) => (
                          <SelectItem key={level} value={level.toString()}>
                            Level {level}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="reward_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Reward Type</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="physical">Physical</SelectItem>
                        <SelectItem value="digital">Digital</SelectItem>
                        <SelectItem value="experience">Experience</SelectItem>
                        <SelectItem value="privilege">Privilege</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription className="text-xs">{getRewardTypeDescription(field.value)}</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="reward_title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Reward Title</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Eco-Friendly Water Bottle" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="reward_description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Describe the reward and how users can claim it..." rows={3} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="is_active"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Active Status</FormLabel>
                    <FormDescription>Reward is active and available for users to claim</FormDescription>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />

            <DialogFooter className="gap-2">
              {reward?.id && (
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
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : reward?.id ? "Update" : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
