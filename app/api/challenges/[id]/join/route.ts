import { createClient } from "@/lib/supabase/server"
import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
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

    // Check if challenge exists and is active
    const { data: challenge, error: challengeError } = await supabase
      .from("challenges")
      .select("*")
      .eq("id", challengeId)
      .eq("is_active", true)
      .single()

    if (challengeError || !challenge) {
      return NextResponse.json({ error: "Challenge not found or inactive" }, { status: 404 })
    }

    if (challenge.challenge_type === "team") {
      return NextResponse.json(
        { error: "Team challenges cannot be joined individually. Contact your team leader." },
        { status: 400 },
      )
    }

    // Check if challenge has ended
    if (new Date(challenge.end_date) < new Date()) {
      return NextResponse.json({ error: "Challenge has ended" }, { status: 400 })
    }

    // Check if user is already participating
    const { data: existingParticipation } = await supabase
      .from("challenge_participants")
      .select("id")
      .eq("challenge_id", challengeId)
      .eq("user_id", user.id)
      .single()

    if (existingParticipation) {
      return NextResponse.json({ error: "Already participating in this challenge" }, { status: 400 })
    }

    if (challenge.max_participants && challenge.challenge_type !== "team") {
      const { data: canJoin, error: checkError } = await supabase.rpc("safe_check_max_participants", {
        challenge_id_param: challengeId,
      })

      if (checkError) {
        console.error("Error checking max participants:", checkError)
        return NextResponse.json({ error: "Failed to validate participation" }, { status: 500 })
      }

      if (!canJoin) {
        return NextResponse.json({ error: "Challenge is full" }, { status: 400 })
      }
    }

    // Add user as participant
    const { data: participation, error: insertError } = await supabase
      .from("challenge_participants")
      .insert({
        challenge_id: challengeId,
        user_id: user.id,
        team_id: null,
        current_progress: 0,
        completed: false,
      })
      .select()
      .single()

    if (insertError) {
      console.error("Error joining challenge:", insertError)
      return NextResponse.json({ error: "Failed to join challenge" }, { status: 500 })
    }

    return NextResponse.json({
      message: "Successfully joined challenge",
      participation,
    })
  } catch (error) {
    console.error("Error joining challenge:", error)
    return NextResponse.json({ error: "Failed to join challenge" }, { status: 500 })
  }
}
