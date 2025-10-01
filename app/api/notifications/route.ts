import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { type NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  const cookieStore = cookies()
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value
      },
    },
  })

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const page = Number.parseInt(searchParams.get("page") || "1")
  const limit = Number.parseInt(searchParams.get("limit") || "20")
  const unreadOnly = searchParams.get("unread_only") === "true"
  const offset = (page - 1) * limit

  try {
    let query = supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1)

    if (unreadOnly) {
      query = query.eq("is_read", false)
    }

    const { data: notifications, error } = await query

    if (error) {
      console.error("Error fetching notifications:", error)
      return NextResponse.json({ error: "Failed to fetch notifications" }, { status: 500 })
    }

    // Get unread count
    const { data: unreadCountData, error: countError } = await supabase.rpc("get_unread_notification_count", {
      p_user_id: user.id,
    })

    if (countError) {
      console.error("Error fetching unread count:", countError)
      return NextResponse.json({ error: "Failed to fetch unread count" }, { status: 500 })
    }

    return NextResponse.json({
      notifications: notifications || [],
      unread_count: unreadCountData || 0,
      page,
      limit,
      has_more: notifications && notifications.length === limit,
    })
  } catch (error) {
    console.error("Error in notifications API:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  const cookieStore = cookies()
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value
      },
    },
  })

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { notification_id, mark_all_read } = body

    if (mark_all_read) {
      // Mark all notifications as read
      const { data, error } = await supabase.rpc("mark_all_notifications_read", { p_user_id: user.id })

      if (error) {
        console.error("Error marking all notifications as read:", error)
        return NextResponse.json({ error: "Failed to mark notifications as read" }, { status: 500 })
      }

      return NextResponse.json({ success: true, updated_count: data })
    } else if (notification_id) {
      // Mark specific notification as read
      const { data, error } = await supabase.rpc("mark_notification_read", {
        notification_id,
        p_user_id: user.id,
      })

      if (error) {
        console.error("Error marking notification as read:", error)
        return NextResponse.json({ error: "Failed to mark notification as read" }, { status: 500 })
      }

      return NextResponse.json({ success: true })
    } else {
      return NextResponse.json({ error: "Missing notification_id or mark_all_read parameter" }, { status: 400 })
    }
  } catch (error) {
    console.error("Error in notifications PUT API:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
