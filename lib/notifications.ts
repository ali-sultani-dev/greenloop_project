import { createClient } from "@/lib/supabase/server"

interface CreateNotificationParams {
  user_id: string
  type:
    | "action_status"
    | "challenge_progress"
    | "team_updates"
    | "announcements"
    | "educational_content"
    | "reward_status"
    | "achievement_alerts"
    | "leaderboard_updates"
  title: string
  message: string
  link_url?: string
  link_type?: "action" | "challenge" | "team" | "reward" | "announcement" | "education" | "leaderboard" | "badge"
  link_id?: string
}

export async function createNotification(params: CreateNotificationParams) {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase.rpc("create_notification", {
      p_user_id: params.user_id,
      p_type: params.type,
      p_title: params.title,
      p_message: params.message,
      p_link_url: params.link_url || null,
      p_link_type: params.link_type || null,
      p_link_id: params.link_id || null,
    })

    if (error) {
      throw new Error(`Database error: ${error.message}`)
    }

    return data
  } catch (error) {
    console.error("Error creating notification:", error)
    throw error
  }
}

// Helper functions for common notification types
export const NotificationHelpers = {
  // Action status notifications
  actionApproved: (user_id: string, actionName: string, points: number, co2Impact?: string) =>
    createNotification({
      user_id,
      type: "action_status",
      title: "Action Approved! ✅",
      message: `Your action '${actionName}' has been approved! +${points} points earned${co2Impact ? ` • ${co2Impact} CO2 impact` : ""}`,
      link_url: "/actions",
      link_type: "action",
    }),

  actionRejected: (user_id: string, actionName: string, reason: string) =>
    createNotification({
      user_id,
      type: "action_status",
      title: "Action Rejected ❌",
      message: `Your action '${actionName}' was rejected. Reason: ${reason}`,
      link_url: "/actions",
      link_type: "action",
    }),

  // Challenge progress notifications
  challengeProgress: (user_id: string, challengeName: string, percentage: number) =>
    createNotification({
      user_id,
      type: "challenge_progress",
      title: "Challenge Progress 🏆",
      message: `You've completed ${percentage}% of '${challengeName}'`,
      link_url: "/challenges",
      link_type: "challenge",
    }),

  challengeCompleted: (user_id: string, challengeName: string, reward: string) =>
    createNotification({
      user_id,
      type: "challenge_progress",
      title: "Challenge Completed! 🎉",
      message: `Challenge completed! You earned ${reward} from '${challengeName}'`,
      link_url: "/challenges",
      link_type: "challenge",
    }),

  challengeRanking: (user_id: string, challengeName: string, rank: number) =>
    createNotification({
      user_id,
      type: "challenge_progress",
      title: "Challenge Ranking 📈",
      message: `You're ranked #${rank} in '${challengeName}'`,
      link_url: "/challenges",
      link_type: "challenge",
    }),

  // Team notifications
  addedToTeam: (user_id: string, teamName: string) =>
    createNotification({
      user_id,
      type: "team_updates",
      title: "Added to Team 👥",
      message: `You've been added to team '${teamName}' by an administrator`,
      link_url: "/teams",
      link_type: "team",
    }),

  teamAchievement: (user_id: string, teamName: string) =>
    createNotification({
      user_id,
      type: "team_updates",
      title: "Team Achievement 🏆",
      message: `Your team '${teamName}' achieved a new milestone!`,
      link_url: "/teams",
      link_type: "team",
    }),

  teamRanking: (user_id: string, teamName: string, rank: number) =>
    createNotification({
      user_id,
      type: "team_updates",
      title: "Team Ranking Update 📊",
      message: `Team '${teamName}' ranking update: Now #${rank}`,
      link_url: "/teams",
      link_type: "team",
    }),

  // Announcement notifications
  announcement: (user_id: string, title: string, content?: string) =>
    createNotification({
      user_id,
      type: "announcements",
      title: `New Announcement: ${title} 📢`,
      message: content || `New announcement: ${title}`,
      link_url: "/announcements",
      link_type: "announcement",
    }),

  // Educational content notifications
  newEducationalContent: (user_id: string, title: string) =>
    createNotification({
      user_id,
      type: "educational_content",
      title: `New Educational Content: '${title}' 📚`,
      message: `New educational content available: ${title}`,
      link_url: "/education",
      link_type: "education",
    }),

  sustainabilityTip: (user_id: string, tipContent: string) =>
    createNotification({
      user_id,
      type: "educational_content",
      title: "Sustainability Tip 💡",
      message: `Sustainability Tip: ${tipContent}`,
      link_url: "/education",
      link_type: "education",
    }),

  // Reward notifications
  rewardApproved: (user_id: string, rewardName: string) =>
    createNotification({
      user_id,
      type: "reward_status",
      title: "Reward Approved 🎁",
      message: `Reward Approved: '${rewardName}' is being processed`,
      link_url: "/rewards",
      link_type: "reward",
    }),

  rewardRejected: (user_id: string, rewardName: string, reason: string) =>
    createNotification({
      user_id,
      type: "reward_status",
      title: "Reward Claim Rejected ❌",
      message: `Reward Claim Rejected: '${rewardName}' - Reason: ${reason}`,
      link_url: "/rewards",
      link_type: "reward",
    }),

  rewardDelivered: (user_id: string, rewardName: string, deliveryNotes: string) =>
    createNotification({
      user_id,
      type: "reward_status",
      title: "Reward Delivered 📦",
      message: `Reward Delivered: '${rewardName}' has been delivered. ${deliveryNotes}`,
      link_url: "/rewards",
      link_type: "reward",
    }),

  // Leaderboard notifications
  leaderboardMovement: (user_id: string, positions: number, currentRank: number) =>
    createNotification({
      user_id,
      type: "leaderboard_updates",
      title: "Leaderboard Update 📈",
      message: `You moved up ${positions} positions on the leaderboard! Now ranked #${currentRank}`,
      link_url: "/leaderboard",
      link_type: "leaderboard",
    }),

  leaderboardTop: (user_id: string) =>
    createNotification({
      user_id,
      type: "leaderboard_updates",
      title: "Top of Leaderboard! 🥇",
      message: `Congratulations! You're now #1 on the leaderboard!`,
      link_url: "/leaderboard",
      link_type: "leaderboard",
    }),

  leaderboardTrending: (user_id: string, positions: number) =>
    createNotification({
      user_id,
      type: "leaderboard_updates",
      title: "Trending Up! ⚡",
      message: `You're trending up! +${positions} positions this week`,
      link_url: "/leaderboard",
      link_type: "leaderboard",
    }),

  // Achievement notifications
  newBadge: (user_id: string, badgeName: string) =>
    createNotification({
      user_id,
      type: "achievement_alerts",
      title: "New Achievement Unlocked! 🏆",
      message: `New Achievement Unlocked: '${badgeName}'`,
      link_url: "/badges",
      link_type: "badge",
    }),

  milestone: (user_id: string, milestoneDescription: string) =>
    createNotification({
      user_id,
      type: "achievement_alerts",
      title: "Milestone Reached! ⭐",
      message: `Milestone Reached: ${milestoneDescription}`,
      link_url: "/profile",
      link_type: "badge",
    }),

  weeklyPoints: (user_id: string, points: number) =>
    createNotification({
      user_id,
      type: "achievement_alerts",
      title: "Weekly Points! 🎯",
      message: `You've earned ${points} points this week!`,
      link_url: "/profile",
      link_type: "badge",
    }),
}
