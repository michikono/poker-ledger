import { beforeEach, describe, expect, it, vi } from "vitest";

const authStateReady = vi.fn();
const getIdToken = vi.fn();
let currentUser: { getIdToken: typeof getIdToken } | null = null;

vi.mock("@/lib/firebase/client", () => ({
  getClientAuth: () => ({
    authStateReady: () => authStateReady(),
    get currentUser() {
      return currentUser;
    },
  }),
}));

const { getToken, redirectToSignIn, withToken } = await import(
  "./client-token"
);

describe("getToken", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authStateReady.mockResolvedValue(undefined);
    getIdToken.mockResolvedValue("fresh-token");
    currentUser = { getIdToken };
  });

  it("returns the current user's ID token after auth is ready", async () => {
    expect(await getToken()).toBe("fresh-token");
    expect(authStateReady).toHaveBeenCalledTimes(1);
    expect(getIdToken).toHaveBeenCalledTimes(1);
  });

  it("returns null when there is no current user", async () => {
    currentUser = null;
    expect(await getToken()).toBeNull();
    expect(getIdToken).not.toHaveBeenCalled();
  });

  it("returns null when getClientAuth throws", async () => {
    authStateReady.mockRejectedValueOnce(new Error("auth init failed"));
    expect(await getToken()).toBeNull();
  });

  it("returns null when getIdToken throws", async () => {
    getIdToken.mockRejectedValueOnce(new Error("token refresh failed"));
    expect(await getToken()).toBeNull();
  });
});

describe("redirectToSignIn", () => {
  it("redirects to /sign-in with a URL-encoded `from` parameter", () => {
    const original = window.location.href;
    Object.defineProperty(window, "location", {
      value: {
        href: original,
        pathname: "/sessions/my session",
        search: "",
      },
      writable: true,
    });

    redirectToSignIn();

    expect(window.location.href).toBe(
      "/sign-in?from=%2Fsessions%2Fmy%20session",
    );
  });

  it("preserves search params (deep links) in the from value", () => {
    Object.defineProperty(window, "location", {
      value: {
        href: "",
        pathname: "/sessions/abc",
        search: "?help=rules",
      },
      writable: true,
    });

    redirectToSignIn();

    expect(window.location.href).toBe(
      "/sign-in?from=%2Fsessions%2Fabc%3Fhelp%3Drules",
    );
  });
});

describe("withToken", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authStateReady.mockResolvedValue(undefined);
    getIdToken.mockResolvedValue("fresh-token");
    currentUser = { getIdToken };
  });

  it("invokes the callback with the resolved token and returns its result", async () => {
    const result = await withToken(async (token) => `used:${token}`);
    expect(result).toBe("used:fresh-token");
  });

  it("redirects and returns null when no token is available", async () => {
    currentUser = null;
    Object.defineProperty(window, "location", {
      value: { href: "", pathname: "/sessions", search: "" },
      writable: true,
    });
    const fn = vi.fn();

    const result = await withToken(fn);

    expect(result).toBeNull();
    expect(fn).not.toHaveBeenCalled();
    expect(window.location.href).toBe("/sign-in?from=%2Fsessions");
  });
});
