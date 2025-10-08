import { createClient } from "@/lib/supabase/server"
import { type NextRequest, NextResponse } from "next/server"

export async function GET() {
  try {
    const supabase = await createClient()

    // Check authentication
    const { data: authData, error: authError } = await supabase.auth.getUser()
    if (authError || !authData?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check if user is admin
    const { data: profile } = await supabase.from("users").select("is_admin").eq("id", authData.user.id).single()

    if (!profile?.is_admin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Get all system settings
    const { data: settings, error } = await supabase.from("system_settings").select("key, setting_value, data_type")

    if (error) {
      console.error("Error fetching settings:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ settings })
  } catch (error: any) {
    console.error("API Error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Check authentication
    const { data: authData, error: authError } = await supabase.auth.getUser()
    if (authError || !authData?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check if user is admin
    const { data: profile } = await supabase.from("users").select("is_admin").eq("id", authData.user.id).single()

    if (!profile?.is_admin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const { settings } = body

    if (!settings || typeof settings !== "object") {
      return NextResponse.json({ error: "Invalid settings data" }, { status: 400 })
    }

    const settingsToSave = [
      {
        key: "platform_name",
        setting_value: settings.platform_name || "GreenLoop",
        data_type: "string",
        category: "general",
      },
      {
        key: "company_name",
        setting_value: settings.company_name || "GreenLoop",
        data_type: "string",
        category: "general",
      },
      {
        key: "challenge_creation_enabled",
        setting_value: (settings.challenge_creation_enabled ?? true).toString(),
        data_type: "boolean",
        category: "general",
      },
      {
        key: "points_per_level",
        setting_value: (settings.points_per_level || 1000).toString(),
        data_type: "number",
        category: "general",
      },
      {
        key: "max_team_size",
        setting_value: (settings.max_team_size || 10).toString(),
        data_type: "number",
        category: "general",
      },
      {
        key: "team_creation_enabled",
        setting_value: (settings.team_creation_enabled ?? true).toString(),
        data_type: "boolean",
        category: "teams",
      },
      {
        key: "user_registration_enabled",
        setting_value: (settings.user_registration_enabled ?? true).toString(),
        data_type: "boolean",
        category: "users",
      },
    ]

    // Use upsert for better reliability
    for (const setting of settingsToSave) {
      const { error } = await supabase.from("system_settings").upsert(
        {
          key: setting.key,
          setting_value: setting.setting_value,
          data_type: setting.data_type,
          category: setting.category,
          updated_at: new Date().toISOString(),
          updated_by: authData.user.id,
        },
        {
          onConflict: "key",
        },
      )

      if (error) {
        console.error(`Error saving setting ${setting.key}:`, error)
        return NextResponse.json({ error: `Failed to save ${setting.key}: ${error.message}` }, { status: 500 })
      }
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("API Error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
