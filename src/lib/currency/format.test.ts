import { describe, expect, it } from "vitest";
import { formatCents } from "./format";

describe("formatCents", () => {
  it("formats zero", () => {
    expect(formatCents(0)).toBe("$0.00");
  });

  it("formats sub-dollar values", () => {
    expect(formatCents(25)).toBe("$0.25");
  });

  it("formats whole dollar amounts", () => {
    expect(formatCents(1000)).toBe("$10.00");
  });

  it("formats values requiring thousands separators", () => {
    expect(formatCents(100000)).toBe("$1,000.00");
  });

  it("formats negative values with a leading minus", () => {
    expect(formatCents(-2500)).toBe("-$25.00");
  });
});
