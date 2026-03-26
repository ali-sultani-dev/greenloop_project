import { POST } from "@/app/api/actions/log/route"
import type { NextRequest } from "next/server"

jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(),
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

const validActionId = "550e8400-e29b-41d4-a716-446655440000"

function createMockRequest(body: object, ip = "127.0.0.1") {
  return {
    json: () => Promise.resolve(body),
    headers: {
      get: (name: string) => (name === "x-forwarded-for" ? ip : null),
    },
  } as unknown as NextRequest
}

function createMockSupabase(opts: {
  getUser?: { data: { user: any }; error: any }
  sustainabilityAction?: { data: any; error: any }
  userProfile?: { data: any; error: any }
  existingAction?: { data: any }
  thresholdSetting?: { data: any; error: any }
  actionLog?: { data: any; error: any }
} = {}) {
  const resultsQueue = [
    opts.sustainabilityAction ?? {
      data: { id: validActionId, title: "Bike to work", points_value: 50, co2_impact: 2.5 },
      error: null,
    },
    opts.userProfile ?? { data: { id: "user-1", points: 100 }, error: null },
    opts.existingAction ?? { data: null },
    opts.thresholdSetting ?? { data: { setting_value: "0" }, error: null },
    opts.actionLog ?? { data: { id: "log-1" }, error: null },
  ]

  const createChain = () => {
    const getNextResult = () => resultsQueue.shift() ?? { data: null, error: null }
    const chain: any = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      single: jest.fn().mockImplementation(() => Promise.resolve(getNextResult())),
      maybeSingle: jest.fn().mockImplementation(() => Promise.resolve(getNextResult())),
      insert: jest.fn().mockReturnThis(),
    }
    chain.insert.mockReturnValue(chain)
    return chain
  }

  return {
    auth: {
      getUser: jest.fn().mockResolvedValue(
        opts.getUser ?? { data: { user: { id: "user-1" } }, error: null }
      ),
    },
    from: jest.fn(() => createChain()),
  }
}

describe("POST /api/actions/log", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("returns 400 for invalid request body (validation error)", async () => {
    const mock = createMockSupabase()
    mockCreateClient.mockResolvedValue(mock)

    const request = createMockRequest({
      action_id: "not-a-uuid",
      has_photos: true,
    })

    const response = await POST(request)
    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.code).toBe("VALIDATION_ERROR")
  })

  it("returns 400 when has_photos is false (photo required)", async () => {
    const mock = createMockSupabase()
    mockCreateClient.mockResolvedValue(mock)

    const request = createMockRequest({
      action_id: validActionId,
      has_photos: false,
    })

    const response = await POST(request)
    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.code).toBe("PHOTO_REQUIRED")
  })

  it("returns 401 when unauthenticated", async () => {
    mockCreateClient.mockResolvedValue(
      createMockSupabase({
        getUser: { data: { user: null }, error: { message: "Not authenticated" } },
      })
    )

    const request = createMockRequest({
      action_id: validActionId,
      has_photos: true,
    })

    const response = await POST(request)
    expect(response.status).toBe(401)
  })

  it("returns 404 when action not found", async () => {
    mockCreateClient.mockResolvedValue(
      createMockSupabase({
        sustainabilityAction: { data: null, error: { message: "Not found" } },
      })
    )

    const request = createMockRequest({
      action_id: validActionId,
      has_photos: true,
    })

    const response = await POST(request)
    expect(response.status).toBe(404)
    const body = await response.json()
    expect(body.code).toBe("ACTION_NOT_FOUND")
  })

  it("returns 404 when user profile not found", async () => {
    mockCreateClient.mockResolvedValue(
      createMockSupabase({
        userProfile: { data: null, error: { message: "Not found" } },
      })
    )

    const request = createMockRequest({
      action_id: validActionId,
      has_photos: true,
    })

    const response = await POST(request)
    expect(response.status).toBe(404)
    const body = await response.json()
    expect(body.code).toBe("USER_NOT_FOUND")
  })

  it("returns 409 for duplicate action within 24h", async () => {
    mockCreateClient.mockResolvedValue(
      createMockSupabase({
        existingAction: { data: { id: "existing-1", completed_at: new Date().toISOString() } },
      })
    )

    const request = createMockRequest({
      action_id: validActionId,
      has_photos: true,
    })

    const response = await POST(request)
    expect(response.status).toBe(409)
    const body = await response.json()
    expect(body.code).toBe("DUPLICATE_ACTION")
  })

  it("returns 429 when rate limit exceeded", async () => {
    const mock = createMockSupabase()
    mockCreateClient.mockResolvedValue(mock)

    const request = createMockRequest(
      { action_id: validActionId, has_photos: true },
      "action-log-rate-limit-test-ip"
    )

    for (let i = 0; i < 21; i++) {
      const r = await POST(request)
      if (r.status === 429) break
    }
    const response = await POST(request)
    expect(response.status).toBe(429)
    const body = await response.json()
    expect(body.code).toBe("RATE_LIMIT_EXCEEDED")
  })
})
