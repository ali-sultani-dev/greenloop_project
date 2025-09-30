import { type NextRequest, NextResponse } from "next/server"
import { authenticateUser, createErrorResponse, ApiException } from "@/lib/api-utils"

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { user, supabase } = await authenticateUser()
    const challengeId = params.id

    // Get challenge details first
    const { data: challenge, error: challengeError } = await supabase
      .from("challenges")
      .select(`
        *,
        challenge_participants (
          id,
          user_id,
          team_id,
          teams (
            id,
            team_members (
              user_id,
              role
            )
          )
        )
      `)
      .eq("id", challengeId)
      .single()

    if (challengeError || !challenge) {
      throw new ApiException({
        message: "Challenge not found",
        code: "NOT_FOUND",
        status: 404,
      })
    }

    // Get user profile to check permissions
    const { data: userProfile } = await supabase.from("users").select("is_admin").eq("id", user.id).single()

    let canDelete = false

    // Check deletion permissions based on challenge type and user role
    if (userProfile?.is_admin) {
      // Admins can delete any challenge
      canDelete = true
    } else if (challenge.challenge_type === "individual" && challenge.created_by === user.id) {
      // Users can delete their own personal challenges
      canDelete = true
    } else if (challenge.challenge_type === "team") {
      // Check if user is team leader for team challenges
      const teamParticipant = challenge.challenge_participants?.find((p: any) => p.team_id && p.teams)

      if (teamParticipant?.teams?.team_members) {
        const userTeamMember = teamParticipant.teams.team_members.find((member: any) => member.user_id === user.id)

        if (userTeamMember?.role === "leader") {
          canDelete = true
        }
      }
    }

    if (!canDelete) {
      throw new ApiException({
        message: "You don't have permission to delete this challenge",
        code: "FORBIDDEN",
        status: 403,
      })
    }

    // Delete the challenge (cascade deletion will handle participants)
    const { error: deleteError } = await supabase.from("challenges").delete().eq("id", challengeId)

    if (deleteError) {
      console.error("Error deleting challenge:", deleteError)
      throw new ApiException({
        message: "Failed to delete challenge",
        code: "DELETE_FAILED",
        status: 500,
        details: deleteError.message,
      })
    }

    // Log admin activity if admin deleted it
    if (userProfile?.is_admin) {
      try {
        await supabase.rpc("log_admin_activity", {
          p_admin_user_id: user.id,
          p_action: "challenge_deleted",
          p_resource_type: "challenges",
          p_resource_id: challengeId,
          p_details: {
            title: challenge.title,
            challenge_type: challenge.challenge_type,
            deleted_by: "admin",
          },
        })
      } catch (logError) {
        console.error("Failed to log admin activity:", logError)
      }
    }

    return NextResponse.json({
      message: "Challenge deleted successfully",
      challengeId,
      deletedBy: userProfile?.is_admin ? "admin" : "user",
    })
  } catch (error) {
    if (error instanceof ApiException) {
      return createErrorResponse(error.error)
    }

    console.error("Unexpected error in DELETE /api/challenges/[id]:", error)
    return createErrorResponse({
      message: "Internal server error",
      code: "INTERNAL_ERROR",
      status: 500,
    })
  }
}
