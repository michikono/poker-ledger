import { describe, expect, it } from "vitest";
import { sortSessions } from "./sort";
import type { SessionSummary } from "./types";

function makeSession(
  partial: Partial<SessionSummary> &
    Pick<SessionSummary, "id" | "status" | "createdAt">,
): SessionSummary {
  return {
    name: partial.id,
    playerCount: 0,
    ...partial,
  };
}

describe("sortSessions", () => {
  it("returns an empty array for empty input", () => {
    expect(sortSessions([])).toEqual([]);
  });

  it("places in_progress before settling before settled", () => {
    const sessions = [
      makeSession({
        id: "c",
        status: "settled",
        createdAt: new Date("2026-01-01"),
      }),
      makeSession({
        id: "b",
        status: "settling",
        createdAt: new Date("2026-01-01"),
      }),
      makeSession({
        id: "a",
        status: "in_progress",
        createdAt: new Date("2026-01-01"),
      }),
    ];
    const sorted = sortSessions(sessions);
    expect(sorted.map((s) => s.id)).toEqual(["a", "b", "c"]);
  });

  it("orders most recent first within the same status group", () => {
    const sessions = [
      makeSession({
        id: "old",
        status: "in_progress",
        createdAt: new Date("2026-01-01"),
      }),
      makeSession({
        id: "new",
        status: "in_progress",
        createdAt: new Date("2026-03-01"),
      }),
      makeSession({
        id: "mid",
        status: "in_progress",
        createdAt: new Date("2026-02-01"),
      }),
    ];
    const sorted = sortSessions(sessions);
    expect(sorted.map((s) => s.id)).toEqual(["new", "mid", "old"]);
  });

  it("combines status priority with recency within group", () => {
    const sessions = [
      makeSession({
        id: "old-progress",
        status: "in_progress",
        createdAt: new Date("2026-01-01"),
      }),
      makeSession({
        id: "new-settled",
        status: "settled",
        createdAt: new Date("2026-04-01"),
      }),
      makeSession({
        id: "new-progress",
        status: "in_progress",
        createdAt: new Date("2026-03-01"),
      }),
      makeSession({
        id: "settling",
        status: "settling",
        createdAt: new Date("2026-02-01"),
      }),
    ];
    const sorted = sortSessions(sessions);
    expect(sorted.map((s) => s.id)).toEqual([
      "new-progress",
      "old-progress",
      "settling",
      "new-settled",
    ]);
  });

  it("excludes archived sessions from the result", () => {
    const sessions = [
      makeSession({
        id: "active",
        status: "in_progress",
        createdAt: new Date("2026-01-01"),
      }),
      makeSession({
        id: "deleted",
        status: "archived",
        createdAt: new Date("2026-02-01"),
      }),
    ];
    const sorted = sortSessions(sessions);
    expect(sorted.map((s) => s.id)).toEqual(["active"]);
  });

  it("does not mutate the input array", () => {
    const sessions = [
      makeSession({
        id: "b",
        status: "settled",
        createdAt: new Date("2026-01-01"),
      }),
      makeSession({
        id: "a",
        status: "in_progress",
        createdAt: new Date("2026-01-01"),
      }),
    ];
    const snapshot = sessions.map((s) => s.id);
    sortSessions(sessions);
    expect(sessions.map((s) => s.id)).toEqual(snapshot);
  });
});
