import { z } from "zod"

const baseChallengeSchema = z.object({
  title: z
    .string()
    .min(3, "Title must be at least 3 characters")
    .max(100, "Title must be less than 100 characters")
    .trim(),

  description: z
    .string()
    .min(10, "Description must be at least 10 characters")
    .max(1000, "Description must be less than 1000 characters")
    .trim(),

  challengeType: z.enum(["individual", "team", "company"], {
    required_error: "Challenge type is required",
  }),

  category: z.enum(
    [
      "Energy",
      "Waste Reduction",
      "Transportation",
      "Water Conservation",
      "Food & Diet",
      "Office Practices",
      "Community",
      "Digital",
      "general",
    ],
    {
      required_error: "Category is required",
    },
  ),

  endDate: z.string(),

  targetMetric: z.enum(["points", "actions", "co2_saved"], {
    required_error: "Target metric is required",
  }),

  targetValue: z
    .number()
    .int("Target value must be a whole number")
    .min(1, "Target value must be at least 1")
    .max(10000, "Target value is too large"),

  rewardPoints: z.number().min(0, "Reward points cannot be negative").max(10000, "Reward points cannot exceed 10,000"),

  rewardDescription: z.string().max(200, "Reward description must be less than 200 characters").optional(),

  maxParticipants: z
    .number()
    .min(1, "Must allow at least 1 participant")
    .max(1000, "Cannot exceed 1000 participants")
    .optional(),

  teamId: z.string().uuid().optional(),
})

export const challengeFormSchema = baseChallengeSchema
  .refine(
    (data) => {
      const endDate = new Date(data.endDate)
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      return endDate > today
    },
    {
      message: "End date must be in the future",
      path: ["endDate"],
    },
  )
  .refine(
    (data) => {
      if (data.challengeType === "team") {
        return !!data.teamId
      }
      return true
    },
    {
      message: "Team ID is required for team challenges",
      path: ["teamId"],
    },
  )
  .refine(
    (data) => {
      if (data.challengeType === "individual" && data.maxParticipants && data.maxParticipants !== 1) {
        return false
      }
      return true
    },
    {
      message: "Individual challenges must have exactly 1 participant",
      path: ["maxParticipants"],
    },
  )

export type ChallengeFormData = z.infer<typeof challengeFormSchema>

const serverBaseSchema = baseChallengeSchema.merge(
  z.object({
    startDate: z.string(),
    createdBy: z.string().uuid(),
  }),
)

export const challengeServerSchema = serverBaseSchema
  .refine(
    (data) => {
      const startDate = new Date(data.startDate)
      const endDate = new Date(data.endDate)
      return endDate > startDate
    },
    {
      message: "End date must be after start date",
      path: ["endDate"],
    },
  )
  .refine(
    (data) => {
      const endDate = new Date(data.endDate)
      const now = new Date()
      return endDate > now
    },
    {
      message: "End date must be in the future",
      path: ["endDate"],
    },
  )
  .refine(
    (data) => {
      if (data.challengeType === "team") {
        return !!data.teamId
      }
      return true
    },
    {
      message: "Team ID is required for team challenges",
      path: ["teamId"],
    },
  )

export type ChallengeServerData = z.infer<typeof challengeServerSchema>

const adminBaseSchema = baseChallengeSchema.merge(
  z.object({
    isActive: z.boolean().default(true),
  }),
)

export const adminChallengeSchema = adminBaseSchema
  .refine(
    (data) => {
      const endDate = new Date(data.endDate)
      const now = new Date()
      return endDate > now
    },
    {
      message: "End date must be in the future",
      path: ["endDate"],
    },
  )
  .refine(
    (data) => {
      if (data.challengeType === "team") {
        return !!data.teamId
      }
      return true
    },
    {
      message: "Team ID is required for team challenges",
      path: ["teamId"],
    },
  )

export type AdminChallengeData = z.infer<typeof adminChallengeSchema>
