import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = await createClient()

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: action, error } = await supabase
      .from("sustainability_actions")
      .select(`
        *,
        action_categories!inner(
          name,
          description,
          color
        )
      `)
      .eq("id", params.id)
      .single()

    if (error) {
      console.error("Error fetching sustainability action:", error)
      return NextResponse.json({ error: "Action not found" }, { status: 404 })
    }

    return NextResponse.json({ data: action })
  } catch (error) {
    console.error("Unexpected error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = await createClient()

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: userProfile } = await supabase.from("users").select("is_admin").eq("id", user.id).single()

    if (!userProfile?.is_admin) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 })
    }

    // Check if action exists
    const { data: existingAction } = await supabase
      .from("sustainability_actions")
      .select("id, title")
      .eq("id", params.id)
      .single()

    if (!existingAction) {
      return NextResponse.json({ error: "Action not found" }, { status: 404 })
    }

    const body = await request.json()
    const {
      title,
      description,
      instructions,
      category_id,
      points_value,
      co2_impact,
      difficulty_level,
      estimated_time_minutes,
      verification_required,
      is_active,
    } = body

    // Validate required fields
    if (!title || !description || !category_id || !points_value || co2_impact === undefined) {
      return NextResponse.json(
        {
          error: "Missing required fields: title, description, category_id, points_value, co2_impact",
        },
        { status: 400 },
      )
    }

    // Validate data types and ranges
    if (typeof points_value !== "number" || points_value < 1 || points_value > 1000) {
      return NextResponse.json(
        {
          error: "Points value must be a number between 1 and 1000",
        },
        { status: 400 },
      )
    }

    if (typeof co2_impact !== "number" || co2_impact < 0) {
      return NextResponse.json(
        {
          error: "CO2 impact must be a non-negative number",
        },
        { status: 400 },
      )
    }

    // Verify category exists
    const { data: category } = await supabase
      .from("action_categories")
      .select("id")
      .eq("id", category_id)
      .eq("is_active", true)
      .single()

    if (!category) {
      return NextResponse.json({ error: "Invalid category ID" }, { status: 400 })
    }

    const updateData = {
      title: title.trim(),
      description: description.trim(),
      instructions: instructions?.trim() || null,
      category_id,
      points_value: Number(points_value),
      co2_impact: Number(co2_impact),
      difficulty_level: Number(difficulty_level) || 1,
      estimated_time_minutes: estimated_time_minutes ? Number(estimated_time_minutes) : null,
      verification_required: Boolean(verification_required),
      is_active: Boolean(is_active),
      updated_at: new Date().toISOString(),
    }

    const { data: updatedAction, error: updateError } = await supabase
      .from("sustainability_actions")
      .update(updateData)
      .eq("id", params.id)
      .select()
      .single()

    if (updateError) {
      console.error("Error updating sustainability action:", updateError)
      return NextResponse.json({ error: "Failed to update action" }, { status: 500 })
    }

    // Log admin activity
    await supabase.rpc("log_admin_activity", {
      p_admin_user_id: user.id,
      p_action: "sustainability_action_updated",
      p_resource_type: "sustainability_actions",
      p_resource_id: params.id,
      p_details: {
        title: updateData.title,
        category_id: updateData.category_id,
        points_value: updateData.points_value,
        is_active: updateData.is_active,
      },
    })

    return NextResponse.json({
      data: updatedAction,
      message: "Sustainability action updated successfully",
    })
  } catch (error) {
    console.error("Unexpected error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = await createClient()

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: userProfile } = await supabase.from("users").select("is_admin").eq("id", user.id).single()

    if (!userProfile?.is_admin) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 })
    }

    // Check if action exists and get details for logging
    const { data: existingAction } = await supabase
      .from("sustainability_actions")
      .select("id, title")
      .eq("id", params.id)
      .single()

    if (!existingAction) {
      return NextResponse.json({ error: "Action not found" }, { status: 404 })
    }

    // Check if action is being used in user actions (prevent deletion if in use)
    const { data: userActions } = await supabase.from("user_actions").select("id").eq("action_id", params.id).limit(1)

    if (userActions && userActions.length > 0) {
      return NextResponse.json(
        {
          error: "Cannot delete action that has been completed by users. Consider deactivating instead.",
        },
        { status: 400 },
      )
    }

    const { error: deleteError } = await supabase.from("sustainability_actions").delete().eq("id", params.id)

    if (deleteError) {
      console.error("Error deleting sustainability action:", deleteError)
      return NextResponse.json({ error: "Failed to delete action" }, { status: 500 })
    }

    // Log admin activity
    await supabase.rpc("log_admin_activity", {
      p_admin_user_id: user.id,
      p_action: "sustainability_action_deleted",
      p_resource_type: "sustainability_actions",
      p_resource_id: params.id,
      p_details: {
        title: existingAction.title,
      },
    })

    return NextResponse.json({
      message: "Sustainability action deleted successfully",
    })
  } catch (error) {
    console.error("Unexpected error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
