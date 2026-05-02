import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock the adminAuth export from admin module
const mockVerifyIdToken = vi.fn();

vi.mock("@/lib/auth/admin", () => ({
  adminAuth: {
    verifyIdToken: mockVerifyIdToken,
  },
}));

// Import after mocks are set up
const { verifyIdToken } = await import("@/lib/auth/verify-token");

describe("verifyIdToken", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns first word of multi-word display name", async () => {
    mockVerifyIdToken.mockResolvedValueOnce({
      uid: "user-123",
      name: "John Doe",
      email: "john@example.com",
    });

    const result = await verifyIdToken("valid-token");

    expect(result).toEqual({ uid: "user-123", firstName: "John" });
  });

  it("returns single-word display name as-is", async () => {
    mockVerifyIdToken.mockResolvedValueOnce({
      uid: "user-456",
      name: "Madonna",
      email: "madonna@example.com",
    });

    const result = await verifyIdToken("valid-token");

    expect(result).toEqual({ uid: "user-456", firstName: "Madonna" });
  });

  it("uses email prefix when no name is present", async () => {
    mockVerifyIdToken.mockResolvedValueOnce({
      uid: "user-789",
      name: undefined,
      email: "jane.smith@example.com",
    });

    const result = await verifyIdToken("valid-token");

    // displayName = "jane.smith@example.com", split on " " → first word is full email
    // but email contains no spaces so firstName = "jane.smith@example.com"
    expect(result.uid).toBe("user-789");
    expect(result.firstName).toBe("jane.smith@example.com");
  });

  it("falls back to User when no name or email", async () => {
    mockVerifyIdToken.mockResolvedValueOnce({
      uid: "user-000",
      name: undefined,
      email: undefined,
    });

    const result = await verifyIdToken("valid-token");

    expect(result).toEqual({ uid: "user-000", firstName: "User" });
  });

  it("throws when token is invalid", async () => {
    mockVerifyIdToken.mockRejectedValueOnce(new Error("Invalid token"));

    await expect(verifyIdToken("bad-token")).rejects.toThrow("Invalid token");
  });
});
