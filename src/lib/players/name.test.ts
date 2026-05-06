import { describe, expect, it } from "vitest";
import { describePlayerNameError, validatePlayerName } from "./name";

describe("validatePlayerName", () => {
  it("accepts a basic alpha name", () => {
    const r = validatePlayerName("Alice");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.trimmed).toBe("Alice");
  });

  it("trims surrounding whitespace before validating", () => {
    const r = validatePlayerName("  Alice  ");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.trimmed).toBe("Alice");
  });

  it("accepts an emoji-only name", () => {
    const r = validatePlayerName("\u{1F3B2}");
    expect(r.ok).toBe(true);
  });

  it("accepts a name with letters and digits", () => {
    expect(validatePlayerName("Player1").ok).toBe(true);
  });

  it("rejects a punctuation-only name like '.'", () => {
    const r = validatePlayerName(".");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.kind).toBe("no_letter_or_emoji");
  });

  it("rejects a digits-only name", () => {
    const r = validatePlayerName("123");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.kind).toBe("no_letter_or_emoji");
  });

  it("rejects an empty/whitespace name", () => {
    expect(validatePlayerName("").ok).toBe(false);
    const r = validatePlayerName("   ");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.kind).toBe("empty");
  });

  it("rejects names longer than 50 characters", () => {
    const r = validatePlayerName("a".repeat(51));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.kind).toBe("too_long");
  });

  it("describes each error kind with a user-facing message", () => {
    expect(describePlayerNameError({ kind: "empty" })).toBe(
      "Name is required.",
    );
    expect(describePlayerNameError({ kind: "too_long" })).toContain("50");
    expect(describePlayerNameError({ kind: "no_letter_or_emoji" })).toContain(
      "letter or emoji",
    );
  });
});
