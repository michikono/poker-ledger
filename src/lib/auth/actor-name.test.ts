import { describe, expect, it } from "vitest";
import { getActorFirstName } from "./actor-name";

describe("getActorFirstName", () => {
  it("extracts the first word of a multi-word name", () => {
    expect(getActorFirstName({ name: "John Smith" })).toBe("John");
  });

  it("returns the whole name when there is only one word", () => {
    expect(getActorFirstName({ name: "Madonna" })).toBe("Madonna");
  });

  it("treats a hyphenated first name as a single token", () => {
    expect(getActorFirstName({ name: "Mary-Jane Smith" })).toBe("Mary-Jane");
  });

  it("falls back to Anonymous when name is an empty string", () => {
    expect(getActorFirstName({ name: "" })).toBe("Anonymous");
  });

  it("falls back to Anonymous when name is undefined", () => {
    expect(getActorFirstName({})).toBe("Anonymous");
  });

  it("never falls back to email when name is missing", () => {
    expect(getActorFirstName({ email: "test@example.com" })).toBe("Anonymous");
  });

  it("falls back to Anonymous when name is whitespace-only", () => {
    expect(getActorFirstName({ name: "   " })).toBe("Anonymous");
  });
});
