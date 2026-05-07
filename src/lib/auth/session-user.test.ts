import { beforeEach, describe, expect, it, vi } from "vitest";

const cookieGet = vi.fn();
const verifySessionCookie = vi.fn();

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: cookieGet }),
}));

vi.mock("@/lib/auth/admin", () => ({
  adminAuth: {
    verifySessionCookie: (...args: unknown[]) => verifySessionCookie(...args),
  },
}));

const { getSessionUser } = await import("./session-user");

describe("getSessionUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when the session cookie is missing", async () => {
    cookieGet.mockReturnValueOnce(undefined);

    const result = await getSessionUser();

    expect(result).toBeNull();
    expect(verifySessionCookie).not.toHaveBeenCalled();
  });

  it("returns null when the session cookie is empty", async () => {
    cookieGet.mockReturnValueOnce({ value: "" });

    const result = await getSessionUser();

    expect(result).toBeNull();
    expect(verifySessionCookie).not.toHaveBeenCalled();
  });

  it("returns null when verifySessionCookie throws", async () => {
    cookieGet.mockReturnValueOnce({ value: "expired-cookie" });
    verifySessionCookie.mockRejectedValueOnce(new Error("expired"));

    const result = await getSessionUser();

    expect(result).toBeNull();
    expect(verifySessionCookie).toHaveBeenCalledWith("expired-cookie", true);
  });

  it("derives firstName from the first whitespace token of decoded.name", async () => {
    cookieGet.mockReturnValueOnce({ value: "valid-cookie" });
    verifySessionCookie.mockResolvedValueOnce({
      uid: "user-1",
      name: "Jane Doe",
      email: "jane@example.com",
    });

    const result = await getSessionUser();

    expect(result).toEqual({ uid: "user-1", firstName: "Jane" });
  });

  it("falls back to email when decoded.name is absent", async () => {
    cookieGet.mockReturnValueOnce({ value: "valid-cookie" });
    verifySessionCookie.mockResolvedValueOnce({
      uid: "user-2",
      email: "alex@example.com",
    });

    const result = await getSessionUser();

    expect(result).toEqual({ uid: "user-2", firstName: "alex@example.com" });
  });

  it("falls back to 'User' when neither name nor email is present", async () => {
    cookieGet.mockReturnValueOnce({ value: "valid-cookie" });
    verifySessionCookie.mockResolvedValueOnce({ uid: "user-3" });

    const result = await getSessionUser();

    expect(result).toEqual({ uid: "user-3", firstName: "User" });
  });
});
