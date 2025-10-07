import { type NextRequest, NextResponse } from "next/server"
import { sustainabilityActionSchema, paginationSchema } from "@/lib/validations/api"
import { authenticateUser, requireAdmin, createErrorResponse, ApiException, sanitizeInput } from "@/lib/api-utils"

export async function GET(request: NextRequest) {
  try {
    const { user, supabase } = await authenticateUser()

    const { searchParams } = new URL(request.url)
    const paginationResult = paginationSchema.safeParse({
      page: searchParams.get("page"),
      limit: searchParams.get("limit"),
    })

    const { page, limit } = paginationResult.success ? paginationResult.data : { page: 1, limit: 20 }
    const category = searchParams.get("category")
    const active = searchParams.get("active")

    let query = supabase.from("sustainability_actions").select(
      `
        *,
        action_categories!inner(
          name,
          description,
          color
        )
      `,
      { count: "exact" },
    )

    // Apply filters
    if (category) {
      query = query.eq("action_categories.name", category)
    }

    if (active !== null) {
      query = query.eq("is_active", active === "true")
    }

    // Apply pagination
    const from = (page - 1) * limit
    const to = from + limit - 1

    const { data: actions, error, count } = await query.range(from, to).order("created_at", { ascending: false })

    if (error) {
      console.error("Error fetching sustainability actions:", error)
      return createErrorResponse({
        message: "Failed to fetch actions",
        code: "DATABASE_ERROR",
        status: 500,
      })
    }

    return NextResponse.json({
      data: actions,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    })
  } catch (error) {
    if (error instanceof ApiException) {
      return createErrorResponse(error.error)
    }

    console.error("Unexpected error:", error)
    return createErrorResponse({
      message: "Internal server error",
      code: "INTERNAL_ERROR",
      status: 500,
    })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user, supabase } = await authenticateUser()
    await requireAdmin(user.id, supabase)

    const rawBody = await request.json()
    const sanitizedBody = sanitizeInput(rawBody)

    const validationResult = sustainabilityActionSchema.safeParse(sanitizedBody)
    if (!validationResult.success) {
      return createErrorResponse({
        message: "Invalid input data",
        code: "VALIDATION_ERROR",
        status: 400,
      })
    }

    const actionData = validationResult.data

    const { data: category, error: categoryError } = await supabase
      .from("action_categories")
      .select("id, name")
      .eq("id", actionData.category_id)
      .eq("is_active", true)
      .single()

    if (categoryError || !category) {
      return createErrorResponse({
        message: "Invalid or inactive category",
        code: "INVALID_CATEGORY",
        status: 400,
      })
    }

    const { data: existingAction } = await supabase
      .from("sustainability_actions")
      .select("id")
      .eq("title", actionData.title)
      .maybeSingle()

    if (existingAction) {
      return createErrorResponse({
        message: "An action with this title already exists",
        code: "DUPLICATE_TITLE",
        status: 409,
      })
    }

    const { data: newAction, error: insertError } = await supabase
      .from("sustainability_actions")
      .insert([actionData])
      .select(`
        *,
        action_categories(name, description, color)
      `)
      .single()

    if (insertError) {
      console.error("Error creating sustainability action:", insertError)
      return createErrorResponse({
        message: "Failed to create action",
        code: "DATABASE_ERROR",
        status: 500,
      })
    }

    try {
      await supabase.rpc("log_admin_activity", {
        p_admin_user_id: user.id,
        p_action: "sustainability_action_created",
        p_resource_type: "sustainability_actions",
        p_resource_id: newAction.id,
        p_details: {
          title: actionData.title,
          category: category.name,
          points_value: actionData.points_value,
          co2_impact: actionData.co2_impact,
        },
      })
    } catch (logError) {
      console.error("Failed to log admin activity:", logError)
      // Don't fail the request for logging issues
    }

    return NextResponse.json(
      {
        data: newAction,
        message: "Sustainability action created successfully",
      },
      { status: 201 },
    )
  } catch (error) {
    if (error instanceof ApiException) {
      return createErrorResponse(error.error)
    }

    console.error("Unexpected error:", error)
    return createErrorResponse({
      message: "Internal server error",
      code: "INTERNAL_ERROR",
      status: 500,
    })
  }
}
