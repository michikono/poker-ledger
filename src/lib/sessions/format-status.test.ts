import { describe, expect, it } from "vitest";
import { formatStatus } from "./format-status";

describe("formatStatus", () => {
  it("formats in_progress as 'In progress'", () => {
    expect(formatStatus("in_progress")).toBe("In progress");
  });

  it("formats settling as 'Settling'", () => {
    expect(formatStatus("settling")).toBe("Settling");
  });

  it("formats settled as 'Settled'", () => {
    expect(formatStatus("settled")).toBe("Settled");
  });

  it("formats archived as 'Archived'", () => {
    expect(formatStatus("archived")).toBe("Archived");
  });
});
