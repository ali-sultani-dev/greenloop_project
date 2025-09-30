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
    const { data: teams, error } = await supabase
      .from("teams")
      .select(`
        *,
        team_members (
          id,
          users (id, first_name, last_name, avatar_url, points)
        )
      `)
      .eq("is_active", true)
      .order("total_points", { ascending: false })

    if (error) throw error

    return NextResponse.json({ teams })
  } catch (error) {
    console.error("Error fetching teams:", error)
    return NextResponse.json({ error: "Failed to fetch teams" }, { status: 500 })
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
    const body = await request.json()
    const { name, description, maxMembers, isPrivate } = body

    // Create team
    const { data: team, error: teamError } = await supabase
      .from("teams")
      .insert({
        name,
        description,
        max_members: maxMembers,
        is_private: isPrivate,
        team_leader_id: user.id,
        created_by: user.id,
      })
      .select()
      .single()

    if (teamError) throw teamError

    // Add creator as team member
    const { error: memberError } = await supabase.from("team_members").insert({
      team_id: team.id,
      user_id: user.id,
      role: "leader",
      joined_at: new Date().toISOString(),
    })

    if (memberError) throw memberError

    return NextResponse.json({ team })
  } catch (error) {
    console.error("Error creating team:", error)
    return NextResponse.json({ error: "Failed to create team" }, { status: 500 })
  }
}
