import { describe, expect, it } from "vitest";
import { asSessionStatus, tsToIso } from "./serialize";

describe("tsToIso", () => {
  it("calls toDate() for Firestore-Timestamp-shaped values", () => {
    const date = new Date("2026-05-07T12:34:56.000Z");
    const ts = { toDate: () => date };

    expect(tsToIso(ts)).toBe("2026-05-07T12:34:56.000Z");
  });

  it("uses Date.toISOString() for native Date instances", () => {
    const date = new Date("2026-01-01T00:00:00.000Z");

    expect(tsToIso(date)).toBe("2026-01-01T00:00:00.000Z");
  });

  it("falls back to epoch zero for undefined", () => {
    expect(tsToIso(undefined)).toBe("1970-01-01T00:00:00.000Z");
  });

  it("falls back to epoch zero for null", () => {
    expect(tsToIso(null)).toBe("1970-01-01T00:00:00.000Z");
  });

  it("falls back to epoch zero for primitive values", () => {
    expect(tsToIso("not-a-date")).toBe("1970-01-01T00:00:00.000Z");
    expect(tsToIso(42)).toBe("1970-01-01T00:00:00.000Z");
  });
});

describe("asSessionStatus", () => {
  it("returns the value when it is a valid SessionStatus", () => {
    expect(asSessionStatus("in_progress")).toBe("in_progress");
    expect(asSessionStatus("settling")).toBe("settling");
    expect(asSessionStatus("settled")).toBe("settled");
    expect(asSessionStatus("archived")).toBe("archived");
  });

  it("falls back to 'in_progress' for an invalid string", () => {
    expect(asSessionStatus("nope")).toBe("in_progress");
    expect(asSessionStatus("")).toBe("in_progress");
  });

  it("falls back to 'in_progress' for non-string values", () => {
    expect(asSessionStatus(undefined)).toBe("in_progress");
    expect(asSessionStatus(null)).toBe("in_progress");
    expect(asSessionStatus(42)).toBe("in_progress");
    expect(asSessionStatus({})).toBe("in_progress");
  });
});
