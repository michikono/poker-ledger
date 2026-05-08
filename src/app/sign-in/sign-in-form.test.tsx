import { describe, expect, it } from "vitest";
import { isSafeInternalPath } from "./sign-in-form";

describe("isSafeInternalPath", () => {
  it("accepts a simple internal path", () => {
    expect(isSafeInternalPath("/sessions")).toBe(true);
  });

  it("accepts a deep-link with search params", () => {
    expect(isSafeInternalPath("/sessions/abc?help=rules")).toBe(true);
  });

  it("accepts a path with multiple search params", () => {
    expect(isSafeInternalPath("/sessions?status=in_progress&page=2")).toBe(
      true,
    );
  });

  it("rejects empty string", () => {
    expect(isSafeInternalPath("")).toBe(false);
  });

  it("rejects paths that don't start with a slash", () => {
    expect(isSafeInternalPath("sessions")).toBe(false);
    expect(isSafeInternalPath("evil.com")).toBe(false);
  });

  it("rejects protocol-relative URLs (// → external host)", () => {
    expect(isSafeInternalPath("//evil.com/foo")).toBe(false);
    expect(isSafeInternalPath("//evil.com")).toBe(false);
  });

  it("rejects absolute URLs with explicit protocols", () => {
    expect(isSafeInternalPath("https://evil.com/foo")).toBe(false);
    expect(isSafeInternalPath("http://evil.com")).toBe(false);
    expect(isSafeInternalPath("javascript://evil")).toBe(false);
  });

  it("rejects backslash-prefixed paths (some browsers normalise to //)", () => {
    expect(isSafeInternalPath("/\\evil.com")).toBe(false);
    expect(isSafeInternalPath("/\\\\evil.com")).toBe(false);
  });

  it("rejects pathologically long inputs", () => {
    expect(isSafeInternalPath(`/${"a".repeat(1001)}`)).toBe(false);
  });
});
