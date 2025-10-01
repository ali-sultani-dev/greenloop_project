import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { type NextRequest, NextResponse } from "next/server"

// This endpoint is for creating notifications (typically called by admin or system processes)
export async function POST(request: NextRequest) {
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
    const { user_id, type, title, message, link_url, link_type, link_id } = body

    // Validate required fields
    if (!user_id || !type || !title || !message) {
      return NextResponse.json(
        {
          error: "Missing required fields: user_id, type, title, message",
        },
        { status: 400 },
      )
    }

    // Create notification using the database function
    const { data, error } = await supabase.rpc("create_notification", {
      p_user_id: user_id,
      p_type: type,
      p_title: title,
      p_message: message,
      p_link_url: link_url || null,
      p_link_type: link_type || null,
      p_link_id: link_id || null,
    })

    if (error) {
      console.error("Error creating notification:", error)
      return NextResponse.json({ error: "Failed to create notification" }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      notification_id: data,
      message: data ? "Notification created successfully" : "Notification not created (user has this type disabled)",
    })
  } catch (error) {
    console.error("Error in create notification API:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
