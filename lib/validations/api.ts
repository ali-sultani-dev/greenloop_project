import { z } from "zod"

// Common validation schemas
export const paginationSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
})

export const idSchema = z.string().uuid("Invalid ID format")

// User action logging validation
export const logActionSchema = z.object({
  action_id: z.string().uuid("Invalid action ID"),
  notes: z.string().max(500, "Notes cannot exceed 500 characters").nullable().optional(),
  has_photos: z.boolean().optional(),
  photo_url: z.string().url("Invalid photo URL").nullable().optional(),
})

// Sustainability action validation
export const sustainabilityActionSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters").max(100, "Title too long").trim(),
  description: z
    .string()
    .min(10, "Description must be at least 10 characters")
    .max(1000, "Description too long")
    .trim(),
  instructions: z.string().max(2000, "Instructions too long").trim().optional(),
  category_id: z.string().uuid("Invalid category ID"),
  points_value: z.number().min(1, "Points must be at least 1").max(1000, "Points cannot exceed 1000"),
  co2_impact: z.number().min(0, "CO2 impact cannot be negative").max(1000, "CO2 impact too high"),
  difficulty_level: z.number().min(1).max(5).default(1),
  estimated_time_minutes: z.number().min(1).max(1440).optional(), // Max 24 hours
  verification_required: z.boolean().default(false),
  is_active: z.boolean().default(true),
})

// Team creation validation
export const teamSchema = z.object({
  name: z.string().min(3, "Team name must be at least 3 characters").max(50, "Team name too long").trim(),
  description: z.string().max(500, "Description too long").trim().optional(),
  max_members: z.number().min(2, "Team must allow at least 2 members").max(100, "Team size too large").default(10),
})

// Profile update validation
export const profileUpdateSchema = z.object({
  first_name: z.string().min(1, "First name is required").max(50, "First name too long").trim(),
  last_name: z.string().min(1, "Last name is required").max(50, "Last name too long").trim(),
  department: z.string().max(100, "Department name too long").trim().optional(),
  job_title: z.string().max(100, "Job title too long").trim().optional(),
  employee_id: z.string().max(50, "Employee ID too long").trim().optional(),
})

// Settings validation
export const userSettingsSchema = z.object({
  email_notifications: z.boolean().default(true),
  push_notifications: z.boolean().default(true),
  weekly_digest: z.boolean().default(true),
  challenge_reminders: z.boolean().default(true),
  privacy_level: z.enum(["public", "team", "private"]).default("team"),
})

export type LogActionData = z.infer<typeof logActionSchema>
export type SustainabilityActionData = z.infer<typeof sustainabilityActionSchema>
export type TeamData = z.infer<typeof teamSchema>
export type ProfileUpdateData = z.infer<typeof profileUpdateSchema>
export type UserSettingsData = z.infer<typeof userSettingsSchema>
