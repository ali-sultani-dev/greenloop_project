import { createClient } from "@/lib/supabase/server"
import { type NextRequest, NextResponse } from "next/server"

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
    // Get user preferences, create if doesn't exist
    let { data: preferences, error: prefError } = await supabase
      .from("user_preferences")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle()

    if (prefError && prefError.code !== "PGRST116") {
      throw prefError
    }

    // If no preferences exist, create default ones
    if (!preferences) {
      const { data: newPreferences, error: createError } = await supabase
        .from("user_preferences")
        .insert({
          user_id: user.id,
          action_status: true,
          challenge_progress: true,
          team_updates: true,
          announcements: true,
          educational_content: true,
          reward_status: true,
          achievement_alerts: true,
          leaderboard_updates: false,
          profile_visibility: "public",
          leaderboard_participation: true,
          analytics_sharing: true,
        })
        .select()
        .single()

      if (createError) throw createError
      preferences = newPreferences
    }

    // Get user profile info for account details
    const { data: userProfile } = await supabase
      .from("users")
      .select("created_at, updated_at, is_admin")
      .eq("id", user.id)
      .single()

    return NextResponse.json({
      preferences,
      account: {
        type: userProfile?.is_admin ? "Admin" : "Employee",
        memberSince: userProfile?.created_at,
        lastUpdated: userProfile?.updated_at,
      },
    })
  } catch (error) {
    console.error("Error fetching settings:", error)
    return NextResponse.json({ error: "Failed to fetch settings" }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await request.json()
    const {
      action_status,
      challenge_progress,
      team_updates,
      announcements,
      educational_content,
      reward_status,
      achievement_alerts,
      leaderboard_updates,
      profile_visibility,
      leaderboard_participation,
      analytics_sharing,
    } = body

    // Validate profile_visibility
    if (profile_visibility && !["public", "private"].includes(profile_visibility)) {
      return NextResponse.json({ error: "Invalid profile visibility value" }, { status: 400 })
    }

    // Update preferences
    const { data: updatedPreferences, error: updateError } = await supabase
      .from("user_preferences")
      .update({
        action_status,
        challenge_progress,
        team_updates,
        announcements,
        educational_content,
        reward_status,
        achievement_alerts,
        leaderboard_updates,
        profile_visibility,
        leaderboard_participation,
        analytics_sharing,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", user.id)
      .select()
      .single()

    if (updateError) throw updateError

    return NextResponse.json({
      message: "Settings updated successfully",
      preferences: updatedPreferences,
    })
  } catch (error) {
    console.error("Error updating settings:", error)
    return NextResponse.json({ error: "Failed to update settings" }, { status: 500 })
  }
}
