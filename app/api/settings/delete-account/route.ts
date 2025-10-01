import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { type NextRequest, NextResponse } from "next/server"

export async function DELETE(request: NextRequest) {
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
    const { confirmationText } = body

    // Require confirmation text
    if (confirmationText !== "DELETE MY ACCOUNT") {
      return NextResponse.json(
        {
          error: "Invalid confirmation text. Please type 'DELETE MY ACCOUNT' to confirm.",
        },
        { status: 400 },
      )
    }

    // Check if user is admin - prevent admin deletion via this endpoint
    const { data: userProfile } = await supabase
      .from("users")
      .select("is_admin, first_name, last_name")
      .eq("id", user.id)
      .single()

    if (userProfile?.is_admin) {
      return NextResponse.json(
        {
          error: "Admin accounts cannot be deleted through this endpoint. Please contact system administrator.",
        },
        { status: 403 },
      )
    }

    console.log(
      `-> Initiating account deletion for user: ${userProfile?.first_name} ${userProfile?.last_name} (${user.id})`,
    )

    // Use admin client to delete user data and auth account
    const adminSupabase = createAdminClient()

    // Delete user from auth (this will cascade delete related data due to foreign key constraints)
    const { error: deleteAuthError } = await adminSupabase.auth.admin.deleteUser(user.id)

    if (deleteAuthError) {
      console.error("-> Error deleting auth user:", deleteAuthError)
      throw deleteAuthError
    }

    console.log("-> Account deletion completed successfully")

    return NextResponse.json({
      message: "Account deleted successfully. You will be redirected to the login page.",
    })
  } catch (error) {
    console.error("Error deleting account:", error)
    return NextResponse.json({ error: "Failed to delete account" }, { status: 500 })
  }
}
