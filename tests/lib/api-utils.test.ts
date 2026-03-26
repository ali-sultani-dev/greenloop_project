import {
  createErrorResponse,
  checkRateLimit,
  sanitizeInput,
} from "@/lib/api-utils"

describe("createErrorResponse", () => {
  it("returns a Response with correct status and JSON body", async () => {
    const error = {
      message: "Test error",
      code: "TEST_ERROR",
      status: 400,
      details: { field: "action_id" },
    }
    const response = createErrorResponse(error)

    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error).toBe("Test error")
    expect(body.code).toBe("TEST_ERROR")
    expect(body.details).toEqual({ field: "action_id" })
    expect(body.timestamp).toBeDefined()
  })

  it("handles minimal error object", async () => {
    const error = {
      message: "Unauthorized",
      status: 401,
    }
    const response = createErrorResponse(error)

    expect(response.status).toBe(401)
    const body = await response.json()
    expect(body.error).toBe("Unauthorized")
    expect(body.code).toBeUndefined()
    expect(body.details).toBeUndefined()
  })
})

describe("checkRateLimit", () => {
  beforeEach(() => {
    // Use unique identifiers per test to avoid cross-test pollution
  })

  it("allows first request within window", () => {
    const result = checkRateLimit("rate-limit-test-1", 5, 60000)
    expect(result).toBe(true)
  })

  it("allows requests up to max within window", () => {
    const id = "rate-limit-test-2"
    for (let i = 0; i < 5; i++) {
      const result = checkRateLimit(id, 5, 60000)
      expect(result).toBe(true)
    }
  })

  it("blocks request when max exceeded within window", () => {
    const id = "rate-limit-test-3"
    for (let i = 0; i < 5; i++) {
      checkRateLimit(id, 5, 60000)
    }
    const result = checkRateLimit(id, 5, 60000)
    expect(result).toBe(false)
  })

  it("allows requests after window resets", () => {
    const id = "rate-limit-test-4"
    for (let i = 0; i < 5; i++) {
      checkRateLimit(id, 5, 1) // 1ms window
    }
    expect(checkRateLimit(id, 5, 1)).toBe(false)

    // Wait for window to reset
    return new Promise((resolve) => {
      setTimeout(() => {
        const result = checkRateLimit(id, 5, 60000)
        expect(result).toBe(true)
        resolve(undefined)
      }, 10)
    })
  })

  it("treats different identifiers independently", () => {
    const idA = "rate-limit-test-5a"
    const idB = "rate-limit-test-5b"

    for (let i = 0; i < 5; i++) {
      checkRateLimit(idA, 5, 60000)
    }
    expect(checkRateLimit(idA, 5, 60000)).toBe(false)
    expect(checkRateLimit(idB, 5, 60000)).toBe(true)
  })
})

describe("sanitizeInput", () => {
  it("trims and strips < and > from strings", () => {
    expect(sanitizeInput("  hello  ")).toBe("hello")
    expect(sanitizeInput("<script>alert('xss')</script>")).toBe(
      "scriptalert('xss')/script"
    )
  })

  it("recursively sanitizes arrays", () => {
    expect(sanitizeInput(["<a>", "  b  ", "c"])).toEqual(["a", "b", "c"])
  })

  it("recursively sanitizes nested objects", () => {
    expect(
      sanitizeInput({
        name: "<b>Bold</b>",
        nested: { value: "  trim  " },
      })
    ).toEqual({
      name: "bBold/b",
      nested: { value: "trim" },
    })
  })

  it("passes through numbers and null", () => {
    expect(sanitizeInput(42)).toBe(42)
    expect(sanitizeInput(null)).toBe(null)
  })

  it("handles deeply nested structures", () => {
    expect(
      sanitizeInput({
        a: [{ b: "<x>" }],
        c: { d: { e: "  nested  " } },
      })
    ).toEqual({
      a: [{ b: "x" }],
      c: { d: { e: "nested" } },
    })
  })
})
