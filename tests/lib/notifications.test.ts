import { NotificationHelpers } from "@/lib/notifications"

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

describe("NotificationHelpers", () => {
  beforeEach(() => {
    jest.clearAllMocks()
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
})
