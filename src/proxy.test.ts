import { describe, expect, it } from "vitest";
import { config, isPublicPath, proxy } from "./proxy";

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

  it("returns true for the Firebase OAuth handler (/__/auth/handler)", () => {
    expect(isPublicPath("/__/auth/handler")).toBe(true);
  });

  it("returns true for Firebase reserved paths (/__/firebase/init.json)", () => {
    expect(isPublicPath("/__/firebase/init.json")).toBe(true);
  });
});

describe("proxy matcher config", () => {
  const [pattern] = config.matcher;
  const matches = (pathname: string) =>
    new RegExp(`^${pattern}$`).test(pathname);

  it("excludes Firebase's /__/ OAuth surface so middleware never runs on it", () => {
    expect(matches("/__/auth/handler")).toBe(false);
    expect(matches("/__/auth/iframe")).toBe(false);
    expect(matches("/__/firebase/init.json")).toBe(false);
  });

  it("still matches normal app routes", () => {
    expect(matches("/sessions")).toBe(true);
    expect(matches("/sign-in")).toBe(true);
  });
});

type FakeRequest = {
  nextUrl: { pathname: string; search: string };
  url: string;
  headers: Headers;
  cookies: { get: (name: string) => { value: string } | undefined };
};

function makeRequest(
  pathnameWithSearch: string,
  sessionCookie?: string,
): FakeRequest {
  const [pathname, ...rest] = pathnameWithSearch.split("?");
  const search = rest.length > 0 ? `?${rest.join("?")}` : "";
  return {
    nextUrl: { pathname: pathname ?? "/", search },
    url: `http://localhost:3000${pathnameWithSearch}`,
    headers: new Headers(),
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

  it("preserves search params (e.g. deep-link ?help=rules) in the from value", () => {
    const req = makeRequest("/sessions/abc?help=rules");
    const res = proxy(req as unknown as Parameters<typeof proxy>[0]);
    expect(res.status).toBe(307);
    const location = res.headers.get("location") ?? "";
    const url = new URL(location);
    expect(url.searchParams.get("from")).toBe("/sessions/abc?help=rules");
  });

  it("preserves multiple search params in the from value", () => {
    const req = makeRequest("/sessions?status=in_progress&page=2");
    const res = proxy(req as unknown as Parameters<typeof proxy>[0]);
    const location = res.headers.get("location") ?? "";
    const url = new URL(location);
    expect(url.searchParams.get("from")).toBe(
      "/sessions?status=in_progress&page=2",
    );
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

  it("does NOT redirect the Firebase OAuth handler even without a session cookie", () => {
    // Regression (spec 0037): once authDomain is the app's own host, the OAuth
    // handler is served from /__/auth/handler. A fresh sign-in has no session
    // cookie, so gating this path redirected it to /sign-in before the rewrite
    // could proxy it to firebaseapp.com — looping sign-in forever.
    const req = makeRequest("/__/auth/handler");
    const res = proxy(req as unknown as Parameters<typeof proxy>[0]);
    expect(res.status).not.toBe(307);
    expect(res.headers.get("location")).toBeNull();
  });
});
