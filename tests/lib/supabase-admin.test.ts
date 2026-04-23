import { createAdminClient } from "@/lib/supabase/admin"

describe("createAdminClient", () => {
  const origUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const origKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  afterEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = origUrl
    process.env.SUPABASE_SERVICE_ROLE_KEY = origKey
  })

  it("throws when NEXT_PUBLIC_SUPABASE_URL is missing", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = ""
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-key"
    expect(() => createAdminClient()).toThrow("Missing Supabase environment variables for admin client")
  })

  it("throws when SUPABASE_SERVICE_ROLE_KEY is missing", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://x.supabase.co"
    process.env.SUPABASE_SERVICE_ROLE_KEY = ""
    expect(() => createAdminClient()).toThrow("Missing Supabase environment variables for admin client")
  })

  it("returns a client when env vars are set", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co"
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key"
    const client = createAdminClient()
    expect(client).toBeDefined()
    expect(client.from).toBeDefined()
  })
})
