import { type NextRequest, NextResponse } from "next/server"
import { authenticateUser, requireAdmin, createErrorResponse, ApiException } from "@/lib/api-utils"
import { createAdminClient } from "@/lib/supabase/admin"

export async function POST(request: NextRequest) {
  try {
    const { user, supabase } = await authenticateUser()
    await requireAdmin(user.id, supabase)

    const { actionId, actionLogId, rejectionReason, isSubmission } = await request.json()

    if (isSubmission) {
      const { data: action, error: actionError } = await supabase
        .from("sustainability_actions")
        .select("*, submitted_by")
        .eq("id", actionId)
        .single()

      if (actionError || !action) {
        return createErrorResponse({
          message: "Action submission not found",
          code: "ACTION_NOT_FOUND",
          status: 404,
        })
      }

      // Handle user-submitted action rejection
      const { error: updateError } = await supabase
        .from("sustainability_actions")
        .update({
          rejection_reason: rejectionReason,
        })
        .eq("id", actionId)

      if (updateError) {
        return createErrorResponse({
          message: "Failed to reject action submission",
          code: "DATABASE_ERROR",
          status: 500,
        })
      }

      // Personal action rejections don't have user_actions records, so we need to handle this differently
      // We'll create a temporary user_action record with rejected status to trigger the notification
      const adminSupabase = createAdminClient()

      try {
        // Create a temporary user_action record to trigger the notification system
        await adminSupabase.from("user_actions").insert({
          user_id: action.submitted_by,
          action_id: actionId,
          points_earned: 0,
          co2_saved: 0,
          verification_status: "rejected",
          notes: rejectionReason,
          verified_by: user.id,
          verified_at: new Date().toISOString(),
          completed_at: new Date().toISOString(),
        })
      } catch (notificationError) {
        console.error("Failed to create notification record:", notificationError)
        // Don't fail the entire request if notification fails
      }

      return NextResponse.json({
        success: true,
        message: "Action submission rejected",
      })
    } else {
      const { data: actionLog, error: logError } = await supabase
        .from("user_actions")
        .select("*, sustainability_actions(title)")
        .eq("id", actionLogId)
        .single()

      if (logError || !actionLog) {
        return createErrorResponse({
          message: "Action log not found",
          code: "ACTION_LOG_NOT_FOUND",
          status: 404,
        })
      }

      // Handle regular action log rejection
      const { error: updateError } = await supabase
        .from("user_actions")
        .update({
          verification_status: "rejected",
          notes: rejectionReason,
          verified_by: user.id,
          verified_at: new Date().toISOString(),
        })
        .eq("id", actionLogId)

      if (updateError) {
        return createErrorResponse({
          message: "Failed to reject action log",
          code: "DATABASE_ERROR",
          status: 500,
        })
      }

      // The trigger_notify_action_status_change will fire when user_actions is updated with verification_status = 'rejected'

      return NextResponse.json({
        success: true,
        message: "Action log rejected",
      })
    }
  } catch (error) {
    if (error instanceof ApiException) {
      return createErrorResponse(error.error)
    }

    console.error("Unexpected error in action rejection:", error)
    return createErrorResponse({
      message: "Internal server error",
      code: "INTERNAL_ERROR",
      status: 500,
    })
  }
}
