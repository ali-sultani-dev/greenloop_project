import { type NextRequest, NextResponse } from "next/server"
import { logActionSchema } from "@/lib/validations/api"
import { authenticateUser, createErrorResponse, ApiException, checkRateLimit, sanitizeInput } from "@/lib/api-utils"

export async function POST(request: NextRequest) {
  try {
    console.log("Starting action log request")

    const clientIP = request.headers.get("x-forwarded-for") || "unknown"

    if (!checkRateLimit(`action-log-${clientIP}`, 20, 60000)) {
      console.log("Rate limit exceeded for IP:", clientIP)
      return createErrorResponse({
        message: "Too many requests. Please try again later.",
        code: "RATE_LIMIT_EXCEEDED",
        status: 429,
      })
    }

    const { user, supabase } = await authenticateUser()
    console.log("User authenticated:", user.id)

    const rawBody = await request.json()
    console.log("Raw request body:", rawBody)

    const sanitizedBody = sanitizeInput(rawBody)
    console.log("Sanitized body:", sanitizedBody)

    const validationResult = logActionSchema.safeParse(sanitizedBody)
    if (!validationResult.success) {
      console.log("Validation failed:", validationResult.error.issues)
      return createErrorResponse({
        message: "Invalid input data",
        code: "VALIDATION_ERROR",
        status: 400,
        details: validationResult.error.issues,
      })
    }

    console.log("Validation passed:", validationResult.data)
    const { action_id, notes, has_photos, photo_url } = validationResult.data

    if (!has_photos) {
      return createErrorResponse({
        message: "Photo proof is required for all actions",
        code: "PHOTO_REQUIRED",
        status: 400,
      })
    }

    // Get action details with better error handling
    const { data: action, error: actionError } = await supabase
      .from("sustainability_actions")
      .select("*")
      .eq("id", action_id)
      .eq("is_active", true) // Only allow active actions
      .single()

    if (actionError || !action) {
      return createErrorResponse({
        message: "Action not found or inactive",
        code: "ACTION_NOT_FOUND",
        status: 404,
      })
    }

    // Get user profile
    const { data: userProfile, error: userError } = await supabase.from("users").select("*").eq("id", user.id).single()

    if (userError || !userProfile) {
      return createErrorResponse({
        message: "User profile not found",
        code: "USER_NOT_FOUND",
        status: 404,
      })
    }

    const { data: existingAction } = await supabase
      .from("user_actions")
      .select("id, completed_at")
      .eq("user_id", user.id)
      .eq("action_id", action_id)
      .gte("completed_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .maybeSingle()

    if (existingAction) {
      return createErrorResponse({
        message: "You've already logged this action in the last 24 hours",
        code: "DUPLICATE_ACTION",
        status: 409,
      })
    }

    const { data: actionLog, error: logError } = await supabase
      .from("user_actions")
      .insert({
        user_id: user.id,
        action_id: action.id,
        points_earned: action.points_value,
        co2_saved: action.co2_impact,
        notes: notes || null,
        verification_status: "pending", // All actions now require verification
        photo_url: photo_url || null,
      })
      .select()
      .single()

    if (logError) {
      console.error("Action log error:", logError)
      return createErrorResponse({
        message: "Failed to log action",
        code: "DATABASE_ERROR",
        status: 500,
      })
    }

    // Points and CO2 will be awarded when admin approves the action

    return NextResponse.json(
      {
        success: true,
        data: {
          userAction: actionLog, // Return userAction for photo upload reference
          action_log: actionLog,
          points_earned: action.points_value,
          co2_saved: action.co2_impact,
          verification_required: true, // All actions now require verification
        },
      },
      { status: 201 },
    )
  } catch (error) {
    console.log("Unexpected error:", error)
    if (error instanceof ApiException) {
      return createErrorResponse(error.error)
    }

    console.error("Unexpected error in action logging:", error)
    return createErrorResponse({
      message: "Internal server error",
      code: "INTERNAL_ERROR",
      status: 500,
    })
  }
}
