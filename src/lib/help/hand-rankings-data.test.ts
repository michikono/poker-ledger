// @vitest-environment node
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { type HandRank, HAND_RANKINGS } from "./hand-rankings-data";

const ALL_RANKS: readonly HandRank[] = [
  "royal-flush",
  "straight-flush",
  "four-of-a-kind",
  "full-house",
  "flush",
  "straight",
  "three-of-a-kind",
  "two-pair",
  "one-pair",
  "high-card",
];

describe("HAND_RANKINGS", () => {
  it("has exactly 10 entries", () => {
    expect(HAND_RANKINGS).toHaveLength(10);
  });

  it("is ordered strongest → weakest", () => {
    expect(HAND_RANKINGS.map((h) => h.rank)).toEqual(ALL_RANKS);
  });

  it("has unique slugs (rank values)", () => {
    const slugs = HAND_RANKINGS.map((h) => h.rank);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("covers every HandRank value (exhaustiveness)", () => {
    const slugs = new Set(HAND_RANKINGS.map((h) => h.rank));
    for (const rank of ALL_RANKS) {
      expect(slugs.has(rank)).toBe(true);
    }
  });

  it("has a non-empty name, oddsLabel, oddsHumanReadable, and explanation for every entry", () => {
    for (const hand of HAND_RANKINGS) {
      expect(hand.name).toBeTruthy();
      expect(hand.oddsLabel).toBeTruthy();
      expect(hand.oddsHumanReadable).toBeTruthy();
      expect(hand.explanation).toBeTruthy();
    }
  });

  it("svgPath points to a file that exists under public/help/hand-rankings/", () => {
    for (const hand of HAND_RANKINGS) {
      expect(hand.svgPath).toBe(`/help/hand-rankings/${hand.rank}.svg`);
      const onDisk = resolve(process.cwd(), "public", hand.svgPath.slice(1));
      expect(existsSync(onDisk), `missing ${onDisk}`).toBe(true);
    }
  });
});
