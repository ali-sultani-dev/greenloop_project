import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)

    const status = searchParams.get("status") || "published"
    const category = searchParams.get("category")
    const limit = searchParams.get("limit")

    let query = supabase
      .from("content_items")
      .select("*")
      .eq("type", "educational")
      .eq("status", status)
      .order("created_at", { ascending: false })

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
