import { createNotification, NotificationHelpers } from "@/lib/notifications"

const mockRpc = jest.fn().mockResolvedValue({ data: { id: "notif-1" }, error: null })

jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(() =>
    Promise.resolve({
      rpc: mockRpc,
    })
  ),
}))

jest.mock("next/headers", () => ({
  cookies: jest.fn(() =>
    Promise.resolve({
      getAll: () => [],
      set: () => {},
    })
  ),
}))

const mockCreateClient = require("@/lib/supabase/server").createClient

describe("createNotification", () => {
  beforeEach(() => {
    mockRpc.mockResolvedValue({ data: { id: "notif-1" }, error: null })
  })

  it("throws when rpc returns an error", async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: { message: "rpc failed" } })
    await expect(
      createNotification({
        user_id: "u1",
        type: "action_status",
        title: "T",
        message: "M",
      })
    ).rejects.toThrow("Database error: rpc failed")
  })

  it("rethrows when supabase client creation fails", async () => {
    mockCreateClient.mockRejectedValueOnce(new Error("no cookies"))
    await expect(
      createNotification({
        user_id: "u1",
        type: "action_status",
        title: "T",
        message: "M",
      })
    ).rejects.toThrow("no cookies")
  })
})

describe("NotificationHelpers", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockCreateClient.mockImplementation(() =>
      Promise.resolve({ rpc: mockRpc })
    )
  })

  it("actionApproved builds correct params", async () => {
    await NotificationHelpers.actionApproved("user-1", "Bike to work", 50)

    expect(mockRpc).toHaveBeenCalledWith(
      "create_notification",
      expect.objectContaining({
        p_user_id: "user-1",
        p_type: "action_status",
        p_title: "Action Approved! ✅",
        p_message: "Your action 'Bike to work' has been approved! +50 points earned",
        p_link_url: "/actions",
        p_link_type: "action",
      })
    )
  })

  it("actionApproved includes co2Impact in message when provided", async () => {
    await NotificationHelpers.actionApproved("user-1", "Bike", 50, "2.5 kg")

    expect(mockRpc).toHaveBeenCalledWith(
      "create_notification",
      expect.objectContaining({
        p_message: expect.stringContaining("Green Score: 2.5 kg"),
      })
    )
  })

  it("actionRejected builds correct params", async () => {
    await NotificationHelpers.actionRejected("user-1", "Bike", "Invalid proof")

    expect(mockRpc).toHaveBeenCalledWith(
      "create_notification",
      expect.objectContaining({
        p_user_id: "user-1",
        p_type: "action_status",
        p_title: "Action Rejected ❌",
      })
    )
  })

  it("challengeCompleted builds correct params", async () => {
    await NotificationHelpers.challengeCompleted("user-1", "Bike Week", "50 points")

    expect(mockRpc).toHaveBeenCalledWith(
      "create_notification",
      expect.objectContaining({
        p_title: "Challenge Completed! 🎉",
        p_message: "Challenge completed! You earned 50 points from 'Bike Week'",
      })
    )
  })

  it("rewardApproved builds correct params", async () => {
    await NotificationHelpers.rewardApproved("user-1", "Eco Mug")

    expect(mockRpc).toHaveBeenCalledWith(
      "create_notification",
      expect.objectContaining({
        p_type: "reward_status",
        p_title: "Reward Approved 🎁",
      })
    )
  })

  it("newBadge builds correct params", async () => {
    await NotificationHelpers.newBadge("user-1", "Eco Champion")

    expect(mockRpc).toHaveBeenCalledWith(
      "create_notification",
      expect.objectContaining({
        p_type: "achievement_alerts",
        p_title: "New Achievement Unlocked! 🏆",
      })
    )
  })

  it("exercises remaining helper factories", async () => {
    await NotificationHelpers.challengeProgress("u1", "C", 50)
    await NotificationHelpers.challengeRanking("u1", "C", 3)
    await NotificationHelpers.addedToTeam("u1", "Team A")
    await NotificationHelpers.teamAchievement("u1", "Team A")
    await NotificationHelpers.teamRanking("u1", "Team A", 2)
    await NotificationHelpers.announcement("u1", "Hi", "body")
    await NotificationHelpers.announcement("u1", "NoBody")
    await NotificationHelpers.newEducationalContent("u1", "Lesson")
    await NotificationHelpers.sustainabilityTip("u1", "Turn off lights")
    await NotificationHelpers.rewardRejected("u1", "Mug", "out of stock")
    await NotificationHelpers.rewardDelivered("u1", "Mug", "Left at desk")
    await NotificationHelpers.leaderboardMovement("u1", 2, 5)
    await NotificationHelpers.leaderboardTop("u1")
    await NotificationHelpers.leaderboardTrending("u1", 4)
    await NotificationHelpers.milestone("u1", "1000 points")
    await NotificationHelpers.weeklyPoints("u1", 42)
    expect(mockRpc).toHaveBeenCalled()
  })
})
