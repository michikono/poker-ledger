import { describe, expect, it } from "vitest";
import { isPublicPath, proxy } from "./proxy";

describe("isPublicPath", () => {
  it("returns true for /sign-in", () => {
    expect(isPublicPath("/sign-in")).toBe(true);
  });

  it("returns true for /sign-in/ (trailing slash)", () => {
    expect(isPublicPath("/sign-in/")).toBe(true);
  });

  it("returns true for sub-paths of /sign-in", () => {
    expect(isPublicPath("/sign-in/callback")).toBe(true);
  });

  it("returns false for /sessions", () => {
    expect(isPublicPath("/sessions")).toBe(false);
  });

  it("returns false for root path", () => {
    expect(isPublicPath("/")).toBe(false);
  });

  it("returns false for /sign-in-something (prefix match should not fire)", () => {
    expect(isPublicPath("/sign-in-something")).toBe(false);
  });
});

type FakeRequest = {
  nextUrl: { pathname: string };
  url: string;
  cookies: { get: (name: string) => { value: string } | undefined };
};

function makeRequest(pathname: string, sessionCookie?: string): FakeRequest {
  return {
    nextUrl: { pathname },
    url: `http://localhost:3000${pathname}`,
    cookies: {
      get: (name: string) =>
        name === "session" && sessionCookie !== undefined
          ? { value: sessionCookie }
          : undefined,
    },
  };
}

describe("proxy", () => {
  it("redirects unauthenticated users from a protected route to /sign-in with from param", () => {
    const req = makeRequest("/sessions");
    const res = proxy(req as unknown as Parameters<typeof proxy>[0]);
    expect(res.status).toBe(307);
    const location = res.headers.get("location") ?? "";
    expect(location).toContain("/sign-in");
    expect(location).toContain("from=%2Fsessions");
  });

  it("does NOT redirect away from /sign-in when a session cookie is present", () => {
    // Regression: presence-only redirect caused an infinite loop with the
    // (app) layout when the cookie was invalid (expired/revoked). The
    // /sign-in server component now handles "already signed in" redirects
    // with full cryptographic verification.
    const req = makeRequest("/sign-in", "any-cookie-value-valid-or-not");
    const res = proxy(req as unknown as Parameters<typeof proxy>[0]);
    expect(res.status).not.toBe(307);
    expect(res.headers.get("location")).toBeNull();
  });

  it("lets authenticated users access protected routes (cookie present, no proxy redirect)", () => {
    const req = makeRequest("/sessions", "session-cookie-value");
    const res = proxy(req as unknown as Parameters<typeof proxy>[0]);
    expect(res.status).not.toBe(307);
  });

  it("lets unauthenticated users access /sign-in without a redirect", () => {
    const req = makeRequest("/sign-in");
    const res = proxy(req as unknown as Parameters<typeof proxy>[0]);
    expect(res.status).not.toBe(307);
    expect(res.headers.get("location")).toBeNull();
  });
});
