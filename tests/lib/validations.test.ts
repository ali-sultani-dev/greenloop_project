import {
  logActionSchema,
  sustainabilityActionSchema,
  teamSchema,
  profileUpdateSchema,
  userSettingsSchema,
} from "@/lib/validations/api"
import {
  challengeFormSchema,
  challengeServerSchema,
  adminChallengeSchema,
} from "@/lib/validations/challenge"

describe("logActionSchema", () => {
  const validUuid = "550e8400-e29b-41d4-a716-446655440000"

  it("accepts valid input", () => {
    const result = logActionSchema.safeParse({
      action_id: validUuid,
      notes: "Test note",
      has_photos: true,
      photo_url: "https://example.com/photo.jpg",
    })
    expect(result.success).toBe(true)
  })

  it("rejects invalid action_id (not UUID)", () => {
    const result = logActionSchema.safeParse({
      action_id: "not-a-uuid",
      has_photos: true,
    })
    expect(result.success).toBe(false)
  })

  it("rejects notes over 500 characters", () => {
    const result = logActionSchema.safeParse({
      action_id: validUuid,
      notes: "a".repeat(501),
      has_photos: true,
    })
    expect(result.success).toBe(false)
  })

  it("rejects invalid photo_url", () => {
    const result = logActionSchema.safeParse({
      action_id: validUuid,
      has_photos: true,
      photo_url: "not-a-url",
    })
    expect(result.success).toBe(false)
  })
})

describe("sustainabilityActionSchema", () => {
  const validBase = {
    title: "Use bike",
    description: "Cycle to work instead of driving",
    category_id: "550e8400-e29b-41d4-a716-446655440000",
    points_value: 50,
    co2_impact: 2.5,
  }

  it("accepts valid input", () => {
    const result = sustainabilityActionSchema.safeParse(validBase)
    expect(result.success).toBe(true)
  })

  it("rejects title under 3 characters", () => {
    const result = sustainabilityActionSchema.safeParse({
      ...validBase,
      title: "ab",
    })
    expect(result.success).toBe(false)
  })

  it("rejects points_value below 1", () => {
    const result = sustainabilityActionSchema.safeParse({
      ...validBase,
      points_value: 0,
    })
    expect(result.success).toBe(false)
  })

  it("rejects co2_impact negative", () => {
    const result = sustainabilityActionSchema.safeParse({
      ...validBase,
      co2_impact: -1,
    })
    expect(result.success).toBe(false)
  })
})

describe("teamSchema", () => {
  it("accepts valid input", () => {
    const result = teamSchema.safeParse({
      name: "Eco Warriors",
      description: "A green team",
      max_members: 10,
    })
    expect(result.success).toBe(true)
  })

  it("rejects name under 3 characters", () => {
    const result = teamSchema.safeParse({
      name: "AB",
    })
    expect(result.success).toBe(false)
  })

  it("rejects max_members below 2", () => {
    const result = teamSchema.safeParse({
      name: "Team Name",
      max_members: 1,
    })
    expect(result.success).toBe(false)
  })
})

describe("profileUpdateSchema", () => {
  it("accepts valid input", () => {
    const result = profileUpdateSchema.safeParse({
      first_name: "John",
      last_name: "Doe",
    })
    expect(result.success).toBe(true)
  })

  it("rejects missing first_name", () => {
    const result = profileUpdateSchema.safeParse({
      last_name: "Doe",
    })
    expect(result.success).toBe(false)
  })

  it("rejects empty last_name", () => {
    const result = profileUpdateSchema.safeParse({
      first_name: "John",
      last_name: "",
    })
    expect(result.success).toBe(false)
  })
})

describe("userSettingsSchema", () => {
  it("accepts valid input and applies defaults", () => {
    const result = userSettingsSchema.safeParse({})
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.privacy_level).toBe("team")
    }
  })

  it("rejects invalid privacy_level", () => {
    const result = userSettingsSchema.safeParse({
      privacy_level: "invalid",
    })
    expect(result.success).toBe(false)
  })
})

describe("challengeFormSchema", () => {
  const futureDate = new Date()
  futureDate.setDate(futureDate.getDate() + 7)

  const validBase = {
    title: "Bike Week",
    description: "Cycle to work every day for a week",
    challengeType: "individual",
    category: "Transportation",
    endDate: futureDate.toISOString(),
    targetMetric: "points",
    targetValue: 100,
    rewardPoints: 50,
  }

  it("accepts valid individual challenge", () => {
    const result = challengeFormSchema.safeParse(validBase)
    expect(result.success).toBe(true)
  })

  it("rejects endDate in the past", () => {
    const result = challengeFormSchema.safeParse({
      ...validBase,
      endDate: "2020-01-01",
    })
    expect(result.success).toBe(false)
  })

  it("requires teamId for team challenges", () => {
    const result = challengeFormSchema.safeParse({
      ...validBase,
      challengeType: "team",
      endDate: futureDate.toISOString(),
    })
    expect(result.success).toBe(false)
  })

  it("accepts team challenge with teamId", () => {
    const result = challengeFormSchema.safeParse({
      ...validBase,
      challengeType: "team",
      teamId: "550e8400-e29b-41d4-a716-446655440000",
      endDate: futureDate.toISOString(),
    })
    expect(result.success).toBe(true)
  })

  it("rejects individual challenge with maxParticipants !== 1", () => {
    const result = challengeFormSchema.safeParse({
      ...validBase,
      challengeType: "individual",
      maxParticipants: 5,
    })
    expect(result.success).toBe(false)
  })
})

describe("challengeServerSchema", () => {
  const futureDate = new Date()
  futureDate.setDate(futureDate.getDate() + 7)
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - 1)

  const validBase = {
    title: "Bike Week",
    description: "Cycle to work every day for a week",
    challengeType: "individual",
    category: "Transportation",
    startDate: startDate.toISOString(),
    endDate: futureDate.toISOString(),
    targetMetric: "points",
    targetValue: 100,
    rewardPoints: 50,
    createdBy: "550e8400-e29b-41d4-a716-446655440000",
  }

  it("accepts valid input", () => {
    const result = challengeServerSchema.safeParse(validBase)
    expect(result.success).toBe(true)
  })

  it("rejects when endDate is before startDate", () => {
    const result = challengeServerSchema.safeParse({
      ...validBase,
      startDate: futureDate.toISOString(),
      endDate: startDate.toISOString(),
    })
    expect(result.success).toBe(false)
  })
})

describe("adminChallengeSchema", () => {
  const futureDate = new Date()
  futureDate.setDate(futureDate.getDate() + 7)

  const validBase = {
    title: "Bike Week",
    description: "Cycle to work every day for a week",
    challengeType: "individual",
    category: "Transportation",
    endDate: futureDate.toISOString(),
    targetMetric: "points",
    targetValue: 100,
    rewardPoints: 50,
    isActive: true,
  }

  it("accepts valid input", () => {
    const result = adminChallengeSchema.safeParse(validBase)
    expect(result.success).toBe(true)
  })

  it("rejects endDate in the past", () => {
    const result = adminChallengeSchema.safeParse({
      ...validBase,
      endDate: "2020-01-01",
    })
    expect(result.success).toBe(false)
  })
})
