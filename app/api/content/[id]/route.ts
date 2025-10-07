import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { NotificationHelpers } from "@/lib/notifications"

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = await createClient()
    const { id } = params

    const { data, error } = await supabase.from("content_items").select("*").eq("id", id).single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    if (!data) {
      return NextResponse.json({ error: "Content not found" }, { status: 404 })
    }

    return NextResponse.json({ data })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = await createClient()
    const { id } = params

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

    const { data: existingContent } = await supabase.from("content_items").select("status, type").eq("id", id).single()

    const wasPublishing = existingContent?.status === "draft" && status === "published"

    const { data, error } = await supabase
      .from("content_items")
      .update({
        title,
        content,
        type,
        category,
        status: status || "draft",
        points: points || 0,
        co2_impact: co2_impact || 0,
        tags: tags || [],
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    if (!data) {
      return NextResponse.json({ error: "Content not found" }, { status: 404 })
    }

    if (data && wasPublishing) {
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
        console.error("Failed to send content update notifications:", notificationError)
        // Don't fail the entire request if notifications fail
      }
    }

    // Log admin activity
    try {
      await supabase.rpc("log_admin_activity", {
        p_admin_user_id: user.id,
        p_action: "content_updated",
        p_resource_type: "content_items",
        p_resource_id: id,
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

    return NextResponse.json({ data })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = await createClient()
    const { id } = params

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

    // Get content details before deletion for logging
    const { data: contentData } = await supabase
      .from("content_items")
      .select("title, type, category")
      .eq("id", id)
      .single()

    const { error } = await supabase.from("content_items").delete().eq("id", id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    // Log admin activity
    if (contentData) {
      try {
        await supabase.rpc("log_admin_activity", {
          p_admin_user_id: user.id,
          p_action: "content_deleted",
          p_resource_type: "content_items",
          p_resource_id: id,
          p_details: {
            title: contentData.title,
            type: contentData.type,
            category: contentData.category,
          },
        })
      } catch (logError) {
        console.error("Failed to log admin activity:", logError)
      }
    }

    return NextResponse.json({ message: "Content deleted successfully" })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
