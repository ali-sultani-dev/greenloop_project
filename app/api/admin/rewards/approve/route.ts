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

    // Update claim status to approved
    const { error: updateError } = await supabase
      .from("user_level_rewards")
      .update({
        claim_status: "approved",
        approved_at: new Date().toISOString(),
        approved_by: user.id,
        admin_notes: adminNotes || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", claimId)

    if (updateError) {
      throw updateError
    }

    try {
      await NotificationHelpers.rewardApproved(claim.user_id, claim.level_rewards?.reward_title || "Reward")
    } catch (notificationError) {
      console.error("Failed to send reward approval notification:", notificationError)
      // Don't fail the main operation if notification fails
    }

    return NextResponse.json({
      success: true,
      message: "Reward claim approved successfully",
    })
  } catch (error) {
    console.error("Error approving reward claim:", error)
    return NextResponse.json({ error: "Failed to approve reward claim" }, { status: 500 })
  }
}
