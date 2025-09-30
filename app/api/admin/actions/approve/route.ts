import { type NextRequest, NextResponse } from "next/server"
import { authenticateUser, requireAdmin, createErrorResponse, ApiException } from "@/lib/api-utils"
import { createAdminClient } from "@/lib/supabase/admin"

export async function POST(request: NextRequest) {
  try {
    const { user, supabase } = await authenticateUser()
    await requireAdmin(user.id, supabase)

    const { actionId, actionLogId, pointsValue, co2Impact, isSubmission } = await request.json()

    if (isSubmission) {
      // Handle user-submitted action approval
      const { data: action, error: actionError } = await supabase
        .from("sustainability_actions")
        .select("*")
        .eq("id", actionId)
        .eq("is_user_created", true)
        .single()

      if (actionError || !action) {
        return createErrorResponse({
          message: "Action submission not found",
          code: "ACTION_NOT_FOUND",
          status: 404,
        })
      }

      const { data: submittedByUser, error: userError } = await supabase
        .from("users")
        .select("*")
        .eq("id", action.submitted_by)
        .single()

      if (userError || !submittedByUser) {
        return createErrorResponse({
          message: "Submitter user not found",
          code: "USER_NOT_FOUND",
          status: 404,
        })
      }

      // Update the action to be active and approved
      const { error: updateError } = await supabase
        .from("sustainability_actions")
        .update({
          is_active: true,
          points_value: pointsValue,
          co2_impact: co2Impact,
          auto_logged_for_submitter: true,
        })
        .eq("id", actionId)

      if (updateError) {
        console.error("Failed to update action:", updateError)
        return createErrorResponse({
          message: "Failed to approve action",
          code: "DATABASE_ERROR",
          status: 500,
        })
      }

      const adminSupabase = createAdminClient()

      try {
        const { data: userActionLog, error: logError } = await adminSupabase
          .from("user_actions")
          .insert({
            user_id: action.submitted_by,
            action_id: actionId,
            points_earned: pointsValue,
            co2_saved: co2Impact,
            verification_status: "approved",
            notes: "Auto-logged upon action approval",
            verified_by: user.id,
            verified_at: new Date().toISOString(),
            completed_at: new Date().toISOString(),
          })
          .select()
          .single()

        if (logError) {
          console.error("Auto-log error:", logError)
          return createErrorResponse({
            message: "Failed to auto-log action for submitter",
            code: "DATABASE_ERROR",
            status: 500,
          })
        }

        const { data: userProfile, error: profileError } = await adminSupabase
          .from("users")
          .select("points, total_co2_saved")
          .eq("id", action.submitted_by)
          .single()

        if (profileError) {
          console.error("Failed to fetch user profile:", profileError)
          return createErrorResponse({
            message: "Failed to fetch user profile",
            code: "DATABASE_ERROR",
            status: 500,
          })
        }

        if (userProfile) {
          const { error: pointsUpdateError } = await adminSupabase
            .from("users")
            .update({
              points: userProfile.points + pointsValue,
            })
            .eq("id", action.submitted_by)

          if (pointsUpdateError) {
            console.error("Failed to update user points:", pointsUpdateError)
            return createErrorResponse({
              message: "Failed to update user points",
              code: "DATABASE_ERROR",
              status: 500,
            })
          }

          // Create points transaction
          const { error: transactionError } = await adminSupabase.from("point_transactions").insert({
            user_id: action.submitted_by,
            points: pointsValue,
            transaction_type: "earned",
            reference_type: "action",
            reference_id: userActionLog.id,
            description: `Completed: ${action.title}`,
          })

          if (transactionError) {
            console.error("Failed to create points transaction:", transactionError)
            // Don't fail the entire request for transaction error
          }
        }

        // The trigger_notify_action_status_change will fire when user_actions is inserted with verification_status = 'approved'

        return NextResponse.json({
          success: true,
          message: "Action approved and auto-logged for submitter",
        })
      } catch (autoLogError) {
        console.error("Auto-log function error:", autoLogError)
        return createErrorResponse({
          message: "Failed to auto-log action for submitter",
          code: "DATABASE_ERROR",
          status: 500,
        })
      }
    } else {
      const adminSupabase = createAdminClient()

      // Fetch action log separately to avoid RLS issues
      const { data: actionLog, error: logError } = await adminSupabase
        .from("user_actions")
        .select("*")
        .eq("id", actionLogId)
        .single()

      if (logError || !actionLog) {
        return createErrorResponse({
          message: "Action log not found",
          code: "ACTION_LOG_NOT_FOUND",
          status: 404,
        })
      }

      // Fetch user and action data separately
      const { data: user_data } = await adminSupabase.from("users").select("*").eq("id", actionLog.user_id).single()

      const { data: action_data } = await adminSupabase
        .from("sustainability_actions")
        .select("*")
        .eq("id", actionLog.action_id)
        .single()

      // Update verification status
      const { error: updateError } = await adminSupabase
        .from("user_actions")
        .update({
          verification_status: "approved",
          verified_by: user.id,
          verified_at: new Date().toISOString(),
        })
        .eq("id", actionLogId)

      if (updateError) {
        return createErrorResponse({
          message: "Failed to approve action log",
          code: "DATABASE_ERROR",
          status: 500,
        })
      }

      // Award points and update CO2 totals
      const { data: userProfile, error: profileError } = await adminSupabase
        .from("users")
        .select("points, total_co2_saved")
        .eq("id", actionLog.user_id)
        .single()

      if (profileError) {
        console.error("Failed to fetch user profile:", profileError)
        return createErrorResponse({
          message: "Failed to fetch user profile",
          code: "DATABASE_ERROR",
          status: 500,
        })
      }

      if (userProfile) {
        const { error: pointsUpdateError } = await adminSupabase
          .from("users")
          .update({
            points: userProfile.points + actionLog.points_earned,
          })
          .eq("id", actionLog.user_id)

        if (pointsUpdateError) {
          console.error("Failed to update user points:", pointsUpdateError)
          return createErrorResponse({
            message: "Failed to update user points",
            code: "DATABASE_ERROR",
            status: 500,
          })
        }

        // Create points transaction
        const { error: transactionError } = await adminSupabase.from("point_transactions").insert({
          user_id: actionLog.user_id,
          points: actionLog.points_earned,
          transaction_type: "earned",
          reference_type: "action",
          reference_id: actionLogId,
          description: `Completed: ${action_data?.title || "Sustainability Action"}`,
        })

        if (transactionError) {
          console.error("Failed to create points transaction:", transactionError)
          // Don't fail the entire request for transaction error
        }
      }

      // The trigger_notify_action_status_change will fire when user_actions is updated with verification_status = 'approved'

      return NextResponse.json({
        success: true,
        message: "Action log approved and points awarded",
      })
    }
  } catch (error) {
    if (error instanceof ApiException) {
      return createErrorResponse(error.error)
    }

    console.error("Unexpected error in action approval:", error)
    return createErrorResponse({
      message: "Internal server error",
      code: "INTERNAL_ERROR",
      status: 500,
    })
  }
}
