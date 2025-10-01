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

  const { searchParams } = new URL(request.url)
  const reportType = searchParams.get("type") || "user"
  const format = searchParams.get("format") || "json"

  try {
    let data: any = {}

    if (reportType === "user") {
      // Export user's personal data
      const { data: userActions } = await supabase
        .from("user_actions")
        .select(`
          *,
          sustainability_actions (
            title,
            category,
            co2_impact,
            points_value
          )
        `)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })

      const { data: userProfile } = await supabase
        .from("users")
        .select("first_name, last_name, email, points, total_co2_saved, level, created_at")
        .eq("id", user.id)
        .single()

      data = {
        profile: userProfile,
        actions: userActions,
        exportDate: new Date().toISOString(),
        reportType: "Personal Sustainability Report",
      }
    } else if (reportType === "admin") {
      // Check if user is admin
      const { data: userProfile } = await supabase.from("users").select("is_admin").eq("id", user.id).single()

      if (!userProfile?.is_admin) {
        return NextResponse.json({ error: "Forbidden - Admin access required" }, { status: 403 })
      }

      // Export organization-wide data
      const { data: allUsers } = await supabase
        .from("users")
        .select("first_name, last_name, email, points, total_co2_saved, level, created_at, last_login")
        .order("points", { ascending: false })

      const { data: allActions } = await supabase
        .from("user_actions")
        .select(`
          created_at,
          sustainability_actions (
            title,
            category,
            co2_impact,
            points_value
          ),
          users (
            first_name,
            last_name,
            email
          )
        `)
        .order("created_at", { ascending: false })

      const { data: allTeams } = await supabase
        .from("teams")
        .select("name, total_points, total_co2_saved, created_at, is_active")
        .order("total_points", { ascending: false })

      data = {
        users: allUsers,
        actions: allActions,
        teams: allTeams,
        exportDate: new Date().toISOString(),
        reportType: "Organization Sustainability Report",
      }
    }

    if (format === "csv") {
      // Convert to CSV format
      const csv = convertToCSV(data)
      return new Response(csv, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="sustainability-report-${new Date().toISOString().split("T")[0]}.csv"`,
        },
      })
    }

    // Return JSON format
    return NextResponse.json(data, {
      headers: {
        "Content-Disposition": `attachment; filename="sustainability-report-${new Date().toISOString().split("T")[0]}.json"`,
      },
    })
  } catch (error) {
    console.error("Error exporting analytics:", error)
    return NextResponse.json({ error: "Failed to export analytics" }, { status: 500 })
  }
}

function convertToCSV(data: any): string {
  // Simple CSV conversion - in production, use a proper CSV library
  if (data.actions) {
    const headers = ["Date", "Action", "Category", "Points", "CO2 Impact"]
    const rows = data.actions.map((action: any) => [
      new Date(action.created_at).toLocaleDateString(),
      action.sustainability_actions?.title || "",
      action.sustainability_actions?.category || "",
      action.sustainability_actions?.points_value || 0,
      action.sustainability_actions?.co2_impact || 0,
    ])

    return [headers, ...rows].map((row) => row.join(",")).join("\n")
  }

  return "No data available"
}
