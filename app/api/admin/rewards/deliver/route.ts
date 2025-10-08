import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { NotificationHelpers } from "@/lib/notifications"

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    const { claimId, adminNotes } = await request.json()

    if (!claimId) {
      return NextResponse.json({ error: "Claim ID is required" }, { status: 400 })
    }

    // Get current user (admin)
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Verify admin status
    const { data: adminProfile } = await supabase.from("users").select("is_admin").eq("id", user.id).single()

    if (!adminProfile?.is_admin) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 })
    }

    // Get claim details before updating
    const { data: claim, error: claimError } = await supabase
      .from("user_level_rewards")
      .select(`
        *,
        level_rewards (
          reward_title,
          reward_description
        )
      `)
      .eq("id", claimId)
      .single()

    if (claimError || !claim) {
      return NextResponse.json({ error: "Claim not found" }, { status: 404 })
    }

    if (claim.claim_status !== "approved") {
      return NextResponse.json({ error: "Only approved claims can be marked as delivered" }, { status: 400 })
    }

    // Update claim status to delivered
    const { error: updateError } = await supabase
      .from("user_level_rewards")
      .update({
        claim_status: "delivered",
        admin_notes: adminNotes || claim.admin_notes,
        updated_at: new Date().toISOString(),
      })
      .eq("id", claimId)

    if (updateError) {
      throw updateError
    }

    try {
      await NotificationHelpers.rewardDelivered(
        claim.user_id,
        claim.level_rewards?.reward_title || "Reward",
        adminNotes || "Your reward has been delivered!",
      )
    } catch (notificationError) {
      console.error("Failed to send reward delivery notification:", notificationError)
      // Don't fail the main operation if notification fails
    }

    return NextResponse.json({
      success: true,
      message: "Reward marked as delivered successfully",
    })
  } catch (error) {
    console.error("Error marking reward as delivered:", error)
    return NextResponse.json({ error: "Failed to mark reward as delivered" }, { status: 500 })
  }
}
