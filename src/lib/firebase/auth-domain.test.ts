import { describe, expect, it } from "vitest";
import { authHandlerRewrites, resolveAuthDomain } from "./auth-domain";

describe("resolveAuthDomain", () => {
  const env = "poker-ledger-8d3bc.firebaseapp.com";

  it("returns the current browser host for a real project", () => {
    expect(resolveAuthDomain(env, "poker-ledger.vercel.app", false)).toBe(
      "poker-ledger.vercel.app",
    );
  });

  it("returns the preview host for a real project on a preview deploy", () => {
    expect(
      resolveAuthDomain(env, "poker-ledger-git-x-team.vercel.app", false),
    ).toBe("poker-ledger-git-x-team.vercel.app");
  });

  it("returns the env authDomain for a demo project even with a host", () => {
    const demoEnv = "demo-poker-ledger.firebaseapp.com";
    expect(resolveAuthDomain(demoEnv, "poker-ledger.vercel.app", true)).toBe(
      demoEnv,
    );
  });

  it("falls back to the env authDomain when host is undefined (SSR)", () => {
    expect(resolveAuthDomain(env, undefined, false)).toBe(env);
  });

  it("falls back to the env authDomain when host is empty", () => {
    expect(resolveAuthDomain(env, "", false)).toBe(env);
  });

  it("returns the host even when the env authDomain is empty", () => {
    expect(resolveAuthDomain("", "poker-ledger.vercel.app", false)).toBe(
      "poker-ledger.vercel.app",
    );
  });
});

describe("authHandlerRewrites", () => {
  const env = "poker-ledger-8d3bc.firebaseapp.com";

  it("proxies the auth and firebase handler paths to the project host", () => {
    expect(authHandlerRewrites(env)).toEqual([
      {
        source: "/__/auth/:path*",
        destination:
          "https://poker-ledger-8d3bc.firebaseapp.com/__/auth/:path*",
      },
      {
        source: "/__/firebase/:path*",
        destination:
          "https://poker-ledger-8d3bc.firebaseapp.com/__/firebase/:path*",
      },
    ]);
  });

  it("returns exactly two rewrites", () => {
    expect(authHandlerRewrites(env)).toHaveLength(2);
  });

  it("returns no rewrites when the env authDomain is empty", () => {
    expect(authHandlerRewrites("")).toEqual([]);
  });
});
