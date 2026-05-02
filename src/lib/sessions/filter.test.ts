import { describe, expect, it } from "vitest";
import { filterSessions } from "./filter";
import type { SessionSummary } from "./types";

function makeSession(name: string): SessionSummary {
  return {
    id: name,
    name,
    status: "in_progress",
    createdAt: new Date("2026-01-01"),
    playerCount: 0,
  };
}

describe("filterSessions", () => {
  const sessions = [
    makeSession("crispy-salmon-042"),
    makeSession("happy-tuna-007"),
    makeSession("crispy-bagel-018"),
  ];

  it("returns all sessions for an empty query", () => {
    expect(filterSessions(sessions, "")).toEqual(sessions);
  });

  it("returns all sessions for a whitespace-only query", () => {
    expect(filterSessions(sessions, "   ")).toEqual(sessions);
  });

  it("matches session names case-insensitively", () => {
    const result = filterSessions(sessions, "CRISPY");
    expect(result.map((s) => s.name)).toEqual([
      "crispy-salmon-042",
      "crispy-bagel-018",
    ]);
  });

  it("matches partial substrings anywhere in the name", () => {
    const result = filterSessions(sessions, "tuna");
    expect(result.map((s) => s.name)).toEqual(["happy-tuna-007"]);
  });

  it("returns an empty array when nothing matches", () => {
    expect(filterSessions(sessions, "nope")).toEqual([]);
  });

  it("trims surrounding whitespace from the query", () => {
    const result = filterSessions(sessions, "  bagel  ");
    expect(result.map((s) => s.name)).toEqual(["crispy-bagel-018"]);
  });
});
