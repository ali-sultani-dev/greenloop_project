import { POST } from "@/app/api/admin/actions/approve/route"
import type { NextRequest } from "next/server"

jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(),
}))

jest.mock("@/lib/supabase/admin", () => ({
  createAdminClient: jest.fn(),
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
const mockCreateAdminClient = require("@/lib/supabase/admin").createAdminClient

function createMockRequest(body: object) {
  return {
    json: () => Promise.resolve(body),
  } as unknown as NextRequest
}

function createMockChain(result: any) {
  const chain: any = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue(result),
    update: jest.fn().mockReturnThis(),
  }
  chain.update.mockResolvedValue({ error: null })
  return chain
}

function createAdminChain(opts?: {
  actionLog?: { data: any; error: any }
  userProfile?: { data: any; error: any }
}) {
  const queue = [
    opts.actionLog ?? { data: { id: "log-1", user_id: "user-1", action_id: "action-1", points_earned: 50 }, error: null },
    { data: null, error: null },
    opts.userProfile ?? { data: { points: 100, total_co2_saved: 10 }, error: null },
  ]
  const chain: any = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn().mockImplementation(() => Promise.resolve(queue.shift() ?? { data: null, error: null })),
    update: jest.fn().mockReturnThis(),
    insert: jest.fn().mockResolvedValue({ error: null }),
  }
  chain.update.mockReturnValue(chain)
  return chain
}

describe("POST /api/admin/actions/approve", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("returns 401 when unauthenticated", async () => {
    mockCreateClient.mockResolvedValue({
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: null }, error: { message: "Not authenticated" } }) },
      from: jest.fn(),
    })

    const request = createMockRequest({
      actionLogId: "log-1",
      actionId: "action-1",
      pointsValue: 50,
      co2Impact: 2.5,
      isSubmission: false,
    })

    const response = await POST(request)
    expect(response.status).toBe(401)
  })

  it("returns 403 when user is not admin", async () => {
    mockCreateClient.mockResolvedValue({
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: "user-1" } }, error: null }) },
      from: jest.fn((table: string) => {
        if (table === "users") {
          return createMockChain({ data: { is_admin: false }, error: null })
        }
        return createMockChain({ data: null, error: null })
      }),
    })

    const request = createMockRequest({
      actionLogId: "log-1",
      isSubmission: false,
    })

    const response = await POST(request)
    expect(response.status).toBe(403)
  })

  it("returns 404 when action log not found (regular approval)", async () => {
    mockCreateClient.mockResolvedValue({
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: "admin-1" } }, error: null }) },
      from: jest.fn(() =>
        createMockChain({ data: { is_admin: true }, error: null })
      ),
    })

    mockCreateAdminClient.mockReturnValue({
      from: jest.fn(() =>
        createAdminChain({
          actionLog: { data: null, error: { message: "Not found" } },
        })
      ),
    })

    const request = createMockRequest({
      actionLogId: "log-1",
      actionId: "action-1",
      pointsValue: 50,
      co2Impact: 2.5,
      isSubmission: false,
    })

    const response = await POST(request)
    expect(response.status).toBe(404)
    const body = await response.json()
    expect(body.code).toBe("ACTION_LOG_NOT_FOUND")
  })

  it("returns 404 when action submission not found (isSubmission)", async () => {
    mockCreateClient.mockResolvedValue({
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: "admin-1" } }, error: null }) },
      from: jest.fn((table: string) => {
        if (table === "users") {
          return createMockChain({ data: { is_admin: true }, error: null })
        }
        if (table === "sustainability_actions") {
          return createMockChain({ data: null, error: { message: "Not found" } })
        }
        return createMockChain({ data: null, error: null })
      }),
    })

    const request = createMockRequest({
      actionId: "action-1",
      pointsValue: 50,
      co2Impact: 2.5,
      isSubmission: true,
    })

    const response = await POST(request)
    expect(response.status).toBe(404)
    const body = await response.json()
    expect(body.code).toBe("ACTION_NOT_FOUND")
  })

  it("returns 200 with success for regular approval flow", async () => {
    const adminResults = [
      { data: { id: "log-1", user_id: "user-1", action_id: "action-1", points_earned: 50 }, error: null },
      { data: null, error: null },
      { data: { title: "Bike" }, error: null },
      { data: { points: 100, total_co2_saved: 10 }, error: null },
    ]
    let adminIndex = 0
    const adminFrom = jest.fn(() => {
      const chain = createAdminChain({})
      chain.single.mockImplementation(() => Promise.resolve(adminResults[adminIndex++] ?? { data: null, error: null }))
      return chain
    })

    mockCreateClient.mockResolvedValue({
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: "admin-1" } }, error: null }) },
      from: jest.fn(() => createMockChain({ data: { is_admin: true }, error: null })),
    })

    mockCreateAdminClient.mockReturnValue({ from: adminFrom })

    const request = createMockRequest({
      actionLogId: "log-1",
      actionId: "action-1",
      pointsValue: 50,
      co2Impact: 2.5,
      isSubmission: false,
    })

    const response = await POST(request)
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.success).toBe(true)
    expect(body.message).toContain("approved")
  })
})
