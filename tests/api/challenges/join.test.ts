import { POST } from "@/app/api/challenges/[id]/join/route"
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

const validChallengeId = "550e8400-e29b-41d4-a716-446655440000"
const futureDate = new Date()
futureDate.setDate(futureDate.getDate() + 7)
const pastDate = new Date()
pastDate.setDate(pastDate.getDate() - 7)

function createMockRequest() {
  return {} as NextRequest
}

function createMockSupabase(opts?: {
  getUser?: { data: { user: any }; error: any }
  challenge?: { data: any; error: any }
  existingParticipation?: { data: any }
  rpc?: { data: any; error: any }
  insert?: { data: any; error: any }
} = {}) {
  const options = opts ?? {}
  const challengeResult =
    options.challenge ?? {
      data: {
        id: validChallengeId,
        challenge_type: "individual",
        end_date: futureDate.toISOString(),
        max_participants: null,
      },
      error: null,
    }

  const existingResult = options.existingParticipation ?? { data: null }
  const insertResult = options.insert ?? { data: { id: "participation-1" }, error: null }

  const fromResults = [challengeResult, existingResult]
  let fromIndex = 0
  const from = jest.fn((table: string) => {
    const chain: any = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockImplementation(() =>
        Promise.resolve(fromResults[fromIndex++] ?? { data: null, error: null })
      ),
      insert: jest.fn().mockReturnThis(),
    }
    chain.insert.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue(insertResult),
    })
    return chain
  })

  return {
    auth: {
      getUser: jest.fn().mockResolvedValue(
        options.getUser ?? { data: { user: { id: "user-1" } }, error: null }
      ),
    },
    from,
    rpc: jest.fn().mockResolvedValue(options.rpc ?? { data: true, error: null }),
  }
}

describe("POST /api/challenges/[id]/join", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("returns 401 when unauthenticated", async () => {
    mockCreateClient.mockResolvedValue(
      createMockSupabase({
        getUser: { data: { user: null }, error: { message: "Not authenticated" } },
      })
    )

    const request = createMockRequest()
    const response = await POST(request, { params: { id: validChallengeId } })

    expect(response.status).toBe(401)
  })

  it("returns 404 when challenge not found", async () => {
    mockCreateClient.mockResolvedValue(
      createMockSupabase({
        challenge: { data: null, error: { message: "Not found" } },
      })
    )

    const request = createMockRequest()
    const response = await POST(request, { params: { id: validChallengeId } })

    expect(response.status).toBe(404)
  })

  it("returns 400 for team challenge (cannot join individually)", async () => {
    mockCreateClient.mockResolvedValue(
      createMockSupabase({
        challenge: {
          data: {
            id: validChallengeId,
            challenge_type: "team",
            end_date: futureDate.toISOString(),
          },
          error: null,
        },
      })
    )

    const request = createMockRequest()
    const response = await POST(request, { params: { id: validChallengeId } })

    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error).toContain("Team challenges")
  })

  it("returns 400 when challenge has ended", async () => {
    mockCreateClient.mockResolvedValue(
      createMockSupabase({
        challenge: {
          data: {
            id: validChallengeId,
            challenge_type: "individual",
            end_date: pastDate.toISOString(),
          },
          error: null,
        },
      })
    )

    const request = createMockRequest()
    const response = await POST(request, { params: { id: validChallengeId } })

    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error).toContain("ended")
  })

  it("returns 400 when already participating", async () => {
    mockCreateClient.mockResolvedValue(
      createMockSupabase({
        existingParticipation: { data: { id: "existing-1" }, error: null },
      })
    )

    const request = createMockRequest()
    const response = await POST(request, { params: { id: validChallengeId } })

    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error).toContain("Already participating")
  })

  it("returns 400 when challenge is full (max participants)", async () => {
    mockCreateClient.mockResolvedValue(
      createMockSupabase({
        challenge: {
          data: {
            id: validChallengeId,
            challenge_type: "individual",
            end_date: futureDate.toISOString(),
            max_participants: 10,
          },
          error: null,
        },
        rpc: { data: false, error: null },
      })
    )

    const request = createMockRequest()
    const response = await POST(request, { params: { id: validChallengeId } })

    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error).toContain("full")
  })

  it("returns 200 with participation on success", async () => {
    const mock = createMockSupabase()
    mockCreateClient.mockResolvedValue(mock)

    const request = createMockRequest()
    const response = await POST(request, { params: { id: validChallengeId } })

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.message).toContain("Successfully joined")
    expect(body.participation).toBeDefined()
  })
})
