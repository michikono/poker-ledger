import { describe, expect, it } from "vitest";
import { DEFAULT_SESSION_FILTER, resolveSessionFilter } from "./filter";

describe("resolveSessionFilter", () => {
  it("defaults to In Progress when the status param is missing", () => {
    expect(resolveSessionFilter(undefined)).toBe("in_progress");
    expect(DEFAULT_SESSION_FILTER).toBe("in_progress");
  });

  it("defaults to In Progress for an unrecognized status", () => {
    expect(resolveSessionFilter("bogus")).toBe("in_progress");
    expect(resolveSessionFilter("")).toBe("in_progress");
  });

  it("returns undefined (all sessions) for the explicit 'all' filter", () => {
    expect(resolveSessionFilter("all")).toBeUndefined();
  });

  it("passes through each valid status", () => {
    expect(resolveSessionFilter("in_progress")).toBe("in_progress");
    expect(resolveSessionFilter("settling")).toBe("settling");
    expect(resolveSessionFilter("settled")).toBe("settled");
    expect(resolveSessionFilter("archived")).toBe("archived");
  });
});
