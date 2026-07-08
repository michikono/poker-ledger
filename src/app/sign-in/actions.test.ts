import { beforeEach, describe, expect, it, vi } from "vitest";

const cookieSet = vi.fn();
const cookieDelete = vi.fn();
const cookieGet = vi.fn();
const redirect = vi.fn((path: string) => {
  throw new Error(`__redirect__:${path}`);
});

const verifyIdToken = vi.fn();
const createSessionCookie = vi.fn();
const verifySessionCookie = vi.fn();
const revokeRefreshTokens = vi.fn();
const archiveStaleSessionsOnLogin = vi.fn();

vi.mock("next/headers", () => ({
  cookies: async () => ({
    set: cookieSet,
    delete: cookieDelete,
    get: cookieGet,
  }),
}));

vi.mock("next/navigation", () => ({
  redirect: (path: string) => redirect(path),
}));

vi.mock("@/lib/auth/admin", () => ({
  adminAuth: {
    createSessionCookie: (...args: unknown[]) => createSessionCookie(...args),
    verifySessionCookie: (...args: unknown[]) => verifySessionCookie(...args),
    revokeRefreshTokens: (...args: unknown[]) => revokeRefreshTokens(...args),
  },
}));

vi.mock("@/lib/auth/verify-token", () => ({
  verifyIdToken: (...args: unknown[]) => verifyIdToken(...args),
}));

vi.mock("@/lib/sessions/garbage-collect", () => ({
  archiveStaleSessionsOnLogin: () => archiveStaleSessionsOnLogin(),
}));

const { createSession, signOut } = await import("./actions");

const FIVE_DAYS_MS = 5 * 24 * 60 * 60 * 1000;
const FIVE_DAYS_S = 5 * 24 * 60 * 60;

describe("createSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    verifyIdToken.mockResolvedValue({ uid: "user-1", firstName: "Jane" });
    createSessionCookie.mockResolvedValue("baked-cookie");
    archiveStaleSessionsOnLogin.mockResolvedValue(undefined);
  });

  it("verifies the ID token and mints a hardened session cookie", async () => {
    await createSession("valid-id-token");

    expect(verifyIdToken).toHaveBeenCalledWith("valid-id-token");
    expect(createSessionCookie).toHaveBeenCalledWith("valid-id-token", {
      expiresIn: FIVE_DAYS_MS,
    });
    expect(cookieSet).toHaveBeenCalledTimes(1);
    expect(cookieSet).toHaveBeenCalledWith("session", "baked-cookie", {
      httpOnly: true,
      sameSite: "lax",
      secure: false, // NODE_ENV is "test" by default, not "production"
      maxAge: FIVE_DAYS_S,
      path: "/",
    });
  });

  it("sets secure: true when NODE_ENV is production", async () => {
    const original = process.env.NODE_ENV;
    vi.stubEnv("NODE_ENV", "production");
    try {
      await createSession("valid-id-token");
      expect(cookieSet).toHaveBeenCalledWith(
        "session",
        "baked-cookie",
        expect.objectContaining({ secure: true }),
      );
    } finally {
      vi.stubEnv("NODE_ENV", original ?? "test");
    }
  });

  it("triggers stale-session GC exactly once after the cookie is set", async () => {
    await createSession("valid-id-token");

    expect(archiveStaleSessionsOnLogin).toHaveBeenCalledTimes(1);
    // Order: cookie set → GC. Both succeeded.
    expect(cookieSet.mock.invocationCallOrder[0]).toBeLessThan(
      archiveStaleSessionsOnLogin.mock.invocationCallOrder[0] ??
        Number.POSITIVE_INFINITY,
    );
  });

  it("throws and does not mint a cookie when verifyIdToken rejects", async () => {
    verifyIdToken.mockRejectedValueOnce(new Error("invalid token"));

    await expect(createSession("bad-token")).rejects.toThrow("invalid token");

    expect(createSessionCookie).not.toHaveBeenCalled();
    expect(cookieSet).not.toHaveBeenCalled();
    expect(archiveStaleSessionsOnLogin).not.toHaveBeenCalled();
  });

  it("propagates createSessionCookie failures without setting the cookie or running GC", async () => {
    createSessionCookie.mockRejectedValueOnce(new Error("admin sdk down"));

    await expect(createSession("valid-id-token")).rejects.toThrow(
      "admin sdk down",
    );

    expect(cookieSet).not.toHaveBeenCalled();
    expect(archiveStaleSessionsOnLogin).not.toHaveBeenCalled();
  });

  it("preserves the existing behaviour when GC throws (cookie is already set)", async () => {
    archiveStaleSessionsOnLogin.mockRejectedValueOnce(new Error("gc broken"));

    await expect(createSession("valid-id-token")).rejects.toThrow("gc broken");

    // Cookie was set BEFORE GC ran — that is the locked-in behaviour.
    expect(cookieSet).toHaveBeenCalledTimes(1);
  });
});

describe("signOut", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cookieGet.mockReturnValue({ value: "valid-session-cookie" });
    verifySessionCookie.mockResolvedValue({ uid: "user-1" });
    revokeRefreshTokens.mockResolvedValue(undefined);
  });

  it("revokes refresh tokens, deletes the session cookie, and redirects", async () => {
    await expect(signOut()).rejects.toThrow("__redirect__:/sign-in");

    expect(verifySessionCookie).toHaveBeenCalledWith(
      "valid-session-cookie",
      true,
    );
    expect(revokeRefreshTokens).toHaveBeenCalledWith("user-1");
    expect(cookieDelete).toHaveBeenCalledWith("session");
    expect(redirect).toHaveBeenCalledWith("/sign-in");

    // Order: revoke → delete cookie → redirect.
    expect(revokeRefreshTokens.mock.invocationCallOrder[0]).toBeLessThan(
      cookieDelete.mock.invocationCallOrder[0] ?? Number.POSITIVE_INFINITY,
    );
    expect(cookieDelete.mock.invocationCallOrder[0]).toBeLessThan(
      redirect.mock.invocationCallOrder[0] ?? Number.POSITIVE_INFINITY,
    );
  });

  it("still clears the cookie and redirects when no session cookie is present", async () => {
    cookieGet.mockReturnValue(undefined);

    await expect(signOut()).rejects.toThrow("__redirect__:/sign-in");

    expect(verifySessionCookie).not.toHaveBeenCalled();
    expect(revokeRefreshTokens).not.toHaveBeenCalled();
    expect(cookieDelete).toHaveBeenCalledWith("session");
    expect(redirect).toHaveBeenCalledWith("/sign-in");
  });

  it("still clears the cookie and redirects when verifySessionCookie throws", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    verifySessionCookie.mockRejectedValueOnce(new Error("expired cookie"));

    await expect(signOut()).rejects.toThrow("__redirect__:/sign-in");

    expect(revokeRefreshTokens).not.toHaveBeenCalled();
    expect(cookieDelete).toHaveBeenCalledWith("session");
    expect(redirect).toHaveBeenCalledWith("/sign-in");
    consoleError.mockRestore();
  });

  it("still clears the cookie and redirects when revokeRefreshTokens throws", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    revokeRefreshTokens.mockRejectedValueOnce(new Error("admin sdk down"));

    await expect(signOut()).rejects.toThrow("__redirect__:/sign-in");

    expect(cookieDelete).toHaveBeenCalledWith("session");
    expect(redirect).toHaveBeenCalledWith("/sign-in");
    consoleError.mockRestore();
  });
});
