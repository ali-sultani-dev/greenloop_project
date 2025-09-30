import { createClient } from "@/lib/supabase/server"
import { type NextRequest, NextResponse } from "next/server"
import { challengeServerSchema } from "@/lib/validations/challenge"

export async function GET(request: NextRequest) {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { data: challenges, error } = await supabase
      .from("challenges")
      .select(`
        *,
        challenge_participants (
          id,
          user_id,
          team_id,
          current_progress,
          completed
        )
      `)
      .eq("is_active", true)
      .gte("end_date", new Date().toISOString())
      .order("start_date", { ascending: false })

    if (error) throw error

    return NextResponse.json({ challenges })
  } catch (error) {
    console.error("Error fetching challenges:", error)
    return NextResponse.json({ error: "Failed to fetch challenges" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    // Get user profile to check permissions
    const { data: userProfile } = await supabase.from("users").select("is_admin").eq("id", user.id).single()

    const body = await request.json()

    const validationResult = challengeServerSchema.safeParse({
      ...body,
      startDate: new Date().toISOString(),
      createdBy: user.id,
    })

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: validationResult.error.flatten().fieldErrors,
        },
        { status: 400 },
      )
    }

    const {
      title,
      description,
      challengeType,
      category,
      endDate,
      rewardPoints,
      targetMetric,
      targetValue,
      rewardDescription,
      maxParticipants,
      teamId,
    } = validationResult.data

    // Validate permissions based on challenge type
    if (challengeType === "company" && !userProfile?.is_admin) {
      return NextResponse.json({ error: "Only admins can create company-wide challenges" }, { status: 403 })
    }

    if (challengeType === "team" && teamId && !userProfile?.is_admin) {
      // Check if user is member of the specified team (only for non-admins)
      const { data: teamMember } = await supabase
        .from("team_members")
        .select("id")
        .eq("user_id", user.id)
        .eq("team_id", teamId)
        .single()

      if (!teamMember) {
        return NextResponse.json(
          { error: "You can only create challenges for teams you're a member of" },
          { status: 403 },
        )
      }
    }

    const { data: challenge, error } = await supabase
      .from("challenges")
      .insert({
        title,
        description,
        challenge_type: challengeType,
        category,
        end_date: endDate,
        reward_points: rewardPoints, // Allow team challenges to have reward points
        target_metric: targetMetric,
        target_value: targetValue,
        reward_description: rewardDescription,
        max_participants: challengeType === "individual" ? 1 : maxParticipants,
        created_by: user.id,
        start_date: validationResult.data.startDate, // Include startDate in the insert
      })
      .select()
      .single()

    if (error) {
      console.error("Database error:", error)
      return NextResponse.json({ error: "Failed to create challenge in database" }, { status: 500 })
    }

    // Removed manual insertion for individual challenges as it's now handled by auto_join_personal_challenge trigger

    if (challengeType === "team" && teamId && challenge) {
      const { error: teamParticipantError } = await supabase.rpc("create_team_challenge_participants", {
        p_challenge_id: challenge.id,
        p_team_id: teamId,
      })

      if (teamParticipantError) {
        console.error("Error creating team participants:", teamParticipantError)
        return NextResponse.json({ error: "Failed to add team participants" }, { status: 500 })
      }
    }

    return NextResponse.json({ challenge })
  } catch (error) {
    console.error("Error creating challenge:", error)
    return NextResponse.json({ error: "Failed to create challenge" }, { status: 500 })
  }
}
