// @vitest-environment node

const PROJECT_ID = "demo-queries-test";
const EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST ?? "localhost:8080";

process.env.FIREBASE_ADMIN_PROJECT_ID = PROJECT_ID;
process.env.FIRESTORE_EMULATOR_HOST = EMULATOR_HOST;

import { Timestamp } from "firebase-admin/firestore";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

const { adminDb } = await import("@/lib/firebase/admin");
const {
  fetchAllSessions,
  fetchAllStatusGroups,
  fetchNavCounts,
  fetchSessionsByStatus,
} = await import("./queries");

async function clearFirestore(): Promise<void> {
  const url = `http://${EMULATOR_HOST}/emulator/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
  const res = await fetch(url, { method: "DELETE" });
  if (!res.ok && res.status !== 200) {
    throw new Error(
      `Failed to clear emulator data: ${res.status} ${await res.text()}`,
    );
  }
}

type SeedSessionInput = {
  id: string;
  name?: string;
  status: "in_progress" | "settling" | "settled" | "archived";
  createdAt: Date;
  players?: string[];
};

async function seedSession(input: SeedSessionInput): Promise<void> {
  const { id, name, status, createdAt, players = [] } = input;
  await adminDb
    .collection("sessions")
    .doc(id)
    .set({
      name: name ?? id,
      status,
      created_at: Timestamp.fromDate(createdAt),
    });
  for (const playerId of players) {
    await adminDb
      .collection("sessions")
      .doc(id)
      .collection("players")
      .doc(playerId)
      .set({ name: playerId });
  }
}

describe("lib/sessions/queries (emulator)", () => {
  beforeEach(async () => {
    await clearFirestore();
  });

  afterAll(async () => {
    await clearFirestore();
  });

  describe("fetchSessionsByStatus", () => {
    it("returns an empty array when no sessions match the status", async () => {
      const result = await fetchSessionsByStatus("in_progress");
      expect(result).toEqual([]);
    });

    it("returns only sessions matching the requested status", async () => {
      await seedSession({
        id: "alpha",
        status: "in_progress",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
      });
      await seedSession({
        id: "beta",
        status: "settling",
        createdAt: new Date("2026-01-02T00:00:00.000Z"),
      });

      const result = await fetchSessionsByStatus("in_progress");

      expect(result).toHaveLength(1);
      expect(result[0]?.id).toBe("alpha");
      expect(result[0]?.status).toBe("in_progress");
    });

    it("orders results by created_at descending (newest first)", async () => {
      await seedSession({
        id: "older",
        status: "in_progress",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
      });
      await seedSession({
        id: "newest",
        status: "in_progress",
        createdAt: new Date("2026-03-01T00:00:00.000Z"),
      });
      await seedSession({
        id: "middle",
        status: "in_progress",
        createdAt: new Date("2026-02-01T00:00:00.000Z"),
      });

      const result = await fetchSessionsByStatus("in_progress");

      expect(result.map((s) => s.id)).toEqual(["newest", "middle", "older"]);
    });

    it("populates playerCount from the players subcollection", async () => {
      await seedSession({
        id: "with-three",
        status: "in_progress",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        players: ["p1", "p2", "p3"],
      });
      await seedSession({
        id: "with-zero",
        status: "in_progress",
        createdAt: new Date("2026-01-02T00:00:00.000Z"),
      });

      const result = await fetchSessionsByStatus("in_progress");

      const counts = Object.fromEntries(
        result.map((s) => [s.id, s.playerCount]),
      );
      expect(counts).toEqual({ "with-three": 3, "with-zero": 0 });
    });

    it("uses the doc id as name when the document has no name field", async () => {
      await adminDb
        .collection("sessions")
        .doc("nameless")
        .set({
          status: "in_progress",
          created_at: Timestamp.fromDate(new Date("2026-01-01T00:00:00.000Z")),
        });

      const result = await fetchSessionsByStatus("in_progress");

      expect(result).toHaveLength(1);
      expect(result[0]?.name).toBe("nameless");
    });
  });

  describe("fetchAllSessions", () => {
    it("returns an empty array when there are no sessions", async () => {
      expect(await fetchAllSessions()).toEqual([]);
    });

    it("returns sessions across all statuses, ordered by created_at desc", async () => {
      await seedSession({
        id: "a",
        status: "archived",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
      });
      await seedSession({
        id: "b",
        status: "in_progress",
        createdAt: new Date("2026-04-01T00:00:00.000Z"),
      });
      await seedSession({
        id: "c",
        status: "settled",
        createdAt: new Date("2026-02-01T00:00:00.000Z"),
      });
      await seedSession({
        id: "d",
        status: "settling",
        createdAt: new Date("2026-03-01T00:00:00.000Z"),
      });

      const result = await fetchAllSessions();

      expect(result.map((s) => s.id)).toEqual(["b", "d", "c", "a"]);
    });
  });

  describe("fetchAllStatusGroups", () => {
    it("returns all four status buckets, each ordered by created_at desc", async () => {
      await seedSession({
        id: "ip-old",
        status: "in_progress",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
      });
      await seedSession({
        id: "ip-new",
        status: "in_progress",
        createdAt: new Date("2026-02-01T00:00:00.000Z"),
      });
      await seedSession({
        id: "settling-1",
        status: "settling",
        createdAt: new Date("2026-01-15T00:00:00.000Z"),
      });

      const result = await fetchAllStatusGroups();

      expect(Object.keys(result).sort()).toEqual(
        ["archived", "in_progress", "settled", "settling"].sort(),
      );
      expect(result.in_progress.map((s) => s.id)).toEqual(["ip-new", "ip-old"]);
      expect(result.settling.map((s) => s.id)).toEqual(["settling-1"]);
      expect(result.settled).toEqual([]);
      expect(result.archived).toEqual([]);
    });
  });

  describe("fetchNavCounts", () => {
    it("returns zero counts when there are no sessions", async () => {
      expect(await fetchNavCounts()).toEqual({ in_progress: 0, settling: 0 });
    });

    it("counts only in_progress and settling sessions", async () => {
      await seedSession({
        id: "ip-1",
        status: "in_progress",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
      });
      await seedSession({
        id: "ip-2",
        status: "in_progress",
        createdAt: new Date("2026-01-02T00:00:00.000Z"),
      });
      await seedSession({
        id: "set-1",
        status: "settling",
        createdAt: new Date("2026-01-03T00:00:00.000Z"),
      });
      await seedSession({
        id: "settled-1",
        status: "settled",
        createdAt: new Date("2026-01-04T00:00:00.000Z"),
      });
      await seedSession({
        id: "arch-1",
        status: "archived",
        createdAt: new Date("2026-01-05T00:00:00.000Z"),
      });

      expect(await fetchNavCounts()).toEqual({ in_progress: 2, settling: 1 });
    });
  });
});
