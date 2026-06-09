import { describe, expect, it } from "vitest";
import { groupBuyInHistory, type RawLogEntry } from "./buy-in-history";

function entry(partial: Partial<RawLogEntry>): RawLogEntry {
  return {
    id: "x",
    actionType: "buy_in_added",
    actorName: "Otter",
    createdAt: "2026-06-09T00:00:00.000Z",
    metadata: {},
    ...partial,
  };
}

describe("groupBuyInHistory", () => {
  it("groups buy-in adds and removals by player with the right kind", () => {
    const out = groupBuyInHistory([
      entry({
        id: "h1",
        actionType: "buy_in_added",
        metadata: { player_id: "p1", amount_cents: 2500 },
      }),
      entry({
        id: "h2",
        actionType: "buy_in_removed",
        metadata: { player_id: "p1", amount_cents: 2500 },
      }),
      entry({
        id: "h3",
        actionType: "buy_in_added",
        metadata: { player_id: "p2", amount_cents: 5000 },
      }),
    ]);

    const p1 = out.p1 ?? [];
    const p2 = out.p2 ?? [];
    expect(p1).toHaveLength(2);
    expect(p1[0]).toMatchObject({ id: "h1", kind: "added", amountCents: 2500 });
    expect(p1[1]).toMatchObject({ id: "h2", kind: "removed" });
    expect(p2).toHaveLength(1);
    expect(p2[0]).toMatchObject({ kind: "added", amountCents: 5000 });
  });

  it("preserves input order per player (callers pass newest-first)", () => {
    const out = groupBuyInHistory([
      entry({ id: "new", metadata: { player_id: "p1", amount_cents: 100 } }),
      entry({ id: "old", metadata: { player_id: "p1", amount_cents: 100 } }),
    ]);
    expect((out.p1 ?? []).map((e) => e.id)).toEqual(["new", "old"]);
  });

  it("ignores non-buy-in events and entries without a player_id", () => {
    const out = groupBuyInHistory([
      entry({ actionType: "cash_out_set", metadata: { player_id: "p1" } }),
      entry({ actionType: "player_renamed", metadata: { player_id: "p1" } }),
      entry({ actionType: "buy_in_added", metadata: {} }),
      entry({ actionType: "buy_in_added", metadata: { player_id: 123 } }),
    ]);
    expect(out).toEqual({});
  });

  it("defaults a missing/invalid amount to 0", () => {
    const out = groupBuyInHistory([
      entry({ id: "h1", metadata: { player_id: "p1" } }),
    ]);
    expect((out.p1 ?? [])[0]?.amountCents).toBe(0);
  });
});
