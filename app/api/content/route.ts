import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { NotificationHelpers } from "@/lib/notifications"

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)

    const type = searchParams.get("type")
    const status = searchParams.get("status")
    const category = searchParams.get("category")
    const limit = searchParams.get("limit")

    let query = supabase.from("content_items").select("*").order("created_at", { ascending: false })

    if (type) {
      query = query.eq("type", type)
    }

    if (status) {
      query = query.eq("status", status)
    }

    if (category) {
      query = query.eq("category", category)
    }

    if (limit) {
      query = query.limit(Number.parseInt(limit))
    }

    const { data, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ data })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
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

    // Check if user is admin
    const { data: profile } = await supabase.from("users").select("is_admin, is_active").eq("id", user.id).single()

    if (!profile?.is_admin || !profile?.is_active) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 })
    }

    const body = await request.json()
    const { title, content, type, category, status, points, co2_impact, tags } = body

    // Validate required fields
    if (!title || !content || !type || !category) {
      return NextResponse.json(
        {
          error: "Missing required fields: title, content, type, category",
        },
        { status: 400 },
      )
    }

    // Validate type
    if (!["announcement", "educational"].includes(type)) {
      return NextResponse.json(
        {
          error: "Invalid type. Must be 'announcement' or 'educational'",
        },
        { status: 400 },
      )
    }

    // Validate status
    if (status && !["draft", "published"].includes(status)) {
      return NextResponse.json(
        {
          error: "Invalid status. Must be 'draft' or 'published'",
        },
        { status: 400 },
      )
    }

    const { data, error } = await supabase
      .from("content_items")
      .insert([
        {
          title,
          content,
          type,
          category,
          status: status || "draft",
          points: points || 0,
          co2_impact: co2_impact || 0,
          tags: tags || [],
          created_by: user.id,
        },
      ])
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    if (data && (status === "published" || !status)) {
      try {
        // Get all active users for notifications
        const { data: activeUsers } = await supabase.from("users").select("id").eq("is_active", true)

        if (activeUsers && activeUsers.length > 0) {
          // Send notifications based on content type
          const notificationPromises = activeUsers.map(async (activeUser) => {
            if (type === "announcement") {
              return NotificationHelpers.announcement(
                activeUser.id,
                title,
                content.substring(0, 100) + (content.length > 100 ? "..." : ""),
              )
            } else if (type === "educational") {
              return NotificationHelpers.newEducationalContent(activeUser.id, title)
            }
          })

          // Send all notifications concurrently
          await Promise.allSettled(notificationPromises)
        }
      } catch (notificationError) {
        console.error("Failed to send content notifications:", notificationError)
        // Don't fail the entire request if notifications fail
      }
    }

    // Log admin activity
    try {
      await supabase.rpc("log_admin_activity", {
        p_admin_user_id: user.id,
        p_action: "content_created",
        p_resource_type: "content_items",
        p_resource_id: data.id,
        p_details: {
          title,
          type,
          category,
          status: status || "draft",
        },
      })
    } catch (logError) {
      console.error("Failed to log admin activity:", logError)
    }

    return NextResponse.json({ data }, { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
