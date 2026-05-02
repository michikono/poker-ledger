import { describe, expect, it } from "vitest";
import { isPublicPath } from "./proxy";

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
