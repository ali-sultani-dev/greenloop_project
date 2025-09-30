import { createClient } from "@/lib/supabase/server"
import { type NextRequest, NextResponse } from "next/server"

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const challengeId = params.id

    console.log(`-> Leave challenge request - User: ${user.id}, Challenge: ${challengeId}`)

    // Check if user is participating
    const { data: participation, error: participationError } = await supabase
      .from("challenge_participants")
      .select("*")
      .eq("challenge_id", challengeId)
      .eq("user_id", user.id)
      .single()

    console.log(`-> Participation check - Found: ${!!participation}, Error: ${participationError?.message}`)

    if (participationError || !participation) {
      return NextResponse.json({ error: "Not participating in this challenge" }, { status: 404 })
    }

    // Don't allow leaving if challenge is completed
    if (participation.completed) {
      return NextResponse.json({ error: "Cannot leave a completed challenge" }, { status: 400 })
    }

    console.log(
      `-> Attempting to delete participation record: ${participation.id} for user: ${user.id} in challenge: ${challengeId}`,
    )

    const {
      data: deleteResult,
      error: deleteError,
      count: deletedCount,
    } = await supabase
      .from("challenge_participants")
      .delete({ count: "exact" })
      .eq("id", participation.id)
      .eq("user_id", user.id) // Double-check user ownership
      .eq("challenge_id", challengeId) // Triple-check challenge match

    console.log(`-> Delete operation - Error: ${deleteError?.message || "none"}, Deleted count: ${deletedCount}`)

    if (deleteError) {
      console.error("Error leaving challenge:", deleteError)
      return NextResponse.json(
        {
          error: "Failed to leave challenge",
          details: deleteError.message,
          code: deleteError.code,
        },
        { status: 500 },
      )
    }

    if (deletedCount === 0) {
      console.error("No records were deleted - possible RLS policy issue")
      return NextResponse.json(
        {
          error: "Failed to leave challenge - no records deleted",
          details: "This might be due to database permissions or RLS policies",
        },
        { status: 500 },
      )
    }

    const { data: verifyDeleted, count } = await supabase
      .from("challenge_participants")
      .select("*", { count: "exact" })
      .eq("challenge_id", challengeId)
      .eq("user_id", user.id)

    console.log(`-> Verification after deletion - records found: ${count}, data: ${JSON.stringify(verifyDeleted)}`)

    return NextResponse.json({
      message: "Successfully left challenge",
      timestamp: new Date().toISOString(),
      debug: {
        deletedRecordId: participation.id,
        deletedCount: deletedCount,
        remainingRecords: count,
        verificationData: verifyDeleted,
      },
    })
  } catch (error) {
    console.error("Error leaving challenge:", error)
    return NextResponse.json({ error: "Failed to leave challenge" }, { status: 500 })
  }
}
