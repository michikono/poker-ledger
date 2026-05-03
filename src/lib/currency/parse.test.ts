import { describe, expect, it } from "vitest";
import { parseDollars } from "./parse";

describe("parseDollars", () => {
  it("parses whole dollars", () => {
    expect(parseDollars("25")).toBe(2500);
  });

  it("accepts an optional $ prefix", () => {
    expect(parseDollars("$25")).toBe(2500);
  });

  it("parses one decimal place", () => {
    expect(parseDollars("25.5")).toBe(2550);
  });

  it("parses two decimal places", () => {
    expect(parseDollars("25.50")).toBe(2550);
  });

  it("parses sub-dollar amounts", () => {
    expect(parseDollars("0.25")).toBe(25);
  });

  it("trims surrounding whitespace", () => {
    expect(parseDollars("  $25.50  ")).toBe(2550);
  });

  it("accepts comma as a decimal separator", () => {
    expect(parseDollars("25,50")).toBe(2550);
  });

  it("rejects amounts with no leading digit before the decimal", () => {
    expect(parseDollars(".25")).toBeNull();
  });

  it("rejects more than two decimal places", () => {
    expect(parseDollars("25.555")).toBeNull();
  });

  it("rejects negatives", () => {
    expect(parseDollars("-5")).toBeNull();
  });

  it("rejects empty string", () => {
    expect(parseDollars("")).toBeNull();
  });

  it("rejects whitespace-only string", () => {
    expect(parseDollars("  ")).toBeNull();
  });

  it("rejects non-numeric input", () => {
    expect(parseDollars("abc")).toBeNull();
  });

  it("rejects thousands separators", () => {
    expect(parseDollars("1,000")).toBeNull();
    expect(parseDollars("1,000.00")).toBeNull();
  });

  it("zero-pads single-digit cent values", () => {
    expect(parseDollars("1.5")).toBe(150);
  });
});
