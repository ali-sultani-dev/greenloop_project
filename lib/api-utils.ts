import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export interface ApiError {
  message: string
  code?: string
  status: number
  details?: any
}

export class ApiException extends Error {
  constructor(public error: ApiError) {
    super(error.message)
  }
}

// Standardized error responses
export function createErrorResponse(error: ApiError) {
  return NextResponse.json(
    {
      error: error.message,
      code: error.code,
      details: error.details,
      timestamp: new Date().toISOString(),
    },
    { status: error.status },
  )
}

// Authentication helper
export async function authenticateUser() {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    throw new ApiException({
      message: "Authentication required",
      code: "UNAUTHORIZED",
      status: 401,
    })
  }

  return { user, supabase }
}

// Admin authorization helper
export async function requireAdmin(userId: string, supabase: any) {
  const { data: userProfile, error } = await supabase.from("users").select("is_admin").eq("id", userId).single()

  if (error || !userProfile?.is_admin) {
    throw new ApiException({
      message: "Admin privileges required",
      code: "FORBIDDEN",
      status: 403,
    })
  }

  return userProfile
}

// Rate limiting helper (simple in-memory implementation)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>()

export function checkRateLimit(identifier: string, maxRequests = 10, windowMs = 60000): boolean {
  const now = Date.now()
  const userLimit = rateLimitMap.get(identifier)

  if (!userLimit || now > userLimit.resetTime) {
    rateLimitMap.set(identifier, { count: 1, resetTime: now + windowMs })
    return true
  }

  if (userLimit.count >= maxRequests) {
    return false
  }

  userLimit.count++
  return true
}

// Input sanitization
export function sanitizeInput(input: any): any {
  if (typeof input === "string") {
    return input.trim().replace(/[<>]/g, "") // Basic XSS prevention
  }
  if (Array.isArray(input)) {
    return input.map(sanitizeInput)
  }
  if (typeof input === "object" && input !== null) {
    const sanitized: any = {}
    for (const [key, value] of Object.entries(input)) {
      sanitized[key] = sanitizeInput(value)
    }
    return sanitized
  }
  return input
}

// Logging helper for security events
export async function logSecurityEvent(
  supabase: any,
  userId: string,
  event: string,
  details: any,
  severity: "low" | "medium" | "high" = "medium",
) {
  try {
    await supabase.from("security_logs").insert({
      user_id: userId,
      event_type: event,
      details,
      severity,
      ip_address: null, // Would need to extract from request headers
      user_agent: null, // Would need to extract from request headers
    })
  } catch (error) {
    console.error("Failed to log security event:", error)
  }
}
