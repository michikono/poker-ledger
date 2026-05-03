import { describe, expect, it } from "vitest";
import { __test__, computeSettlement } from "./compute";
import type { PlayerInput, Payment } from "./types";

function p(
  id: string,
  totalBuyInCents: number,
  cashOutCents: number | null,
  createdAtMs = 1000,
): PlayerInput {
  return { id, createdAtMs, totalBuyInCents, cashOutCents };
}

function flowByPlayer(
  players: PlayerInput[],
  payments: Payment[],
): Map<string, number> {
  const flow = new Map<string, number>();
  for (const player of players) flow.set(player.id, 0);
  for (const pay of payments) {
    flow.set(
      pay.fromPlayerId,
      (flow.get(pay.fromPlayerId) ?? 0) - pay.amountCents,
    );
    flow.set(pay.toPlayerId, (flow.get(pay.toPlayerId) ?? 0) + pay.amountCents);
  }
  return flow;
}

describe("computeSettlement — basic cases", () => {
  it("returns no payments for an empty player list", () => {
    expect(computeSettlement([])).toEqual([]);
  });

  it("returns no payments for a single player with zero net", () => {
    expect(computeSettlement([p("a", 5000, 5000)])).toEqual([]);
  });

  it("returns no payments when all nets are zero", () => {
    const players = [p("a", 5000, 5000), p("b", 5000, 5000)];
    expect(computeSettlement(players)).toEqual([]);
  });

  it("settles two players with even, opposing nets in one payment", () => {
    // A nets +10000, B nets -10000.
    const players = [p("a", 10000, 20000, 100), p("b", 10000, 0, 200)];
    expect(computeSettlement(players)).toEqual([
      { fromPlayerId: "b", toPlayerId: "a", amountCents: 10000 },
    ]);
  });

  it("settles two players with uneven amounts in one payment", () => {
    // A: +3000, B: -3000.
    const players = [p("a", 5000, 8000, 100), p("b", 5000, 2000, 200)];
    expect(computeSettlement(players)).toEqual([
      { fromPlayerId: "b", toPlayerId: "a", amountCents: 3000 },
    ]);
  });
});

describe("computeSettlement — minimum-transactions algorithm", () => {
  it("resolves a 3-player chain in at most 2 payments and balances to zero", () => {
    // A: -50, B: +20, C: +30. Sum = 0.
    const players = [
      p("a", 50, 0, 100),
      p("b", 30, 50, 200),
      p("c", 0, 30, 300),
    ];
    const payments = computeSettlement(players);
    expect(payments.length).toBeLessThanOrEqual(2);
    const flow = flowByPlayer(players, payments);
    expect(flow.get("a")).toBe(-50);
    expect(flow.get("b")).toBe(20);
    expect(flow.get("c")).toBe(30);
  });

  it("resolves a 5-player ring in at most 4 payments and balances to zero", () => {
    // Nets: A=+20, B=+30, C=-40, D=-10, E=0.
    const players = [
      p("a", 0, 20, 100),
      p("b", 0, 30, 200),
      p("c", 40, 0, 300),
      p("d", 10, 0, 400),
      p("e", 50, 50, 500),
    ];
    const payments = computeSettlement(players);
    expect(payments.length).toBeLessThanOrEqual(4);
    const flow = flowByPlayer(players, payments);
    expect(flow.get("a")).toBe(20);
    expect(flow.get("b")).toBe(30);
    expect(flow.get("c")).toBe(-40);
    expect(flow.get("d")).toBe(-10);
    expect(flow.get("e")).toBe(0);
  });

  it("settles a single creditor with multiple debtors", () => {
    // A: +60 creditor, B: -30, C: -30 debtors.
    const players = [
      p("a", 0, 60, 100),
      p("b", 30, 0, 200),
      p("c", 30, 0, 300),
    ];
    const payments = computeSettlement(players);
    expect(payments.length).toBe(2);
    const flow = flowByPlayer(players, payments);
    expect(flow.get("a")).toBe(60);
    expect(flow.get("b")).toBe(-30);
    expect(flow.get("c")).toBe(-30);
    for (const pay of payments) expect(pay.toPlayerId).toBe("a");
  });

  it("excludes zero-net players from payments", () => {
    const players = [
      p("a", 0, 50, 100),
      p("b", 50, 0, 200),
      p("c", 25, 25, 300),
    ];
    const payments = computeSettlement(players);
    expect(payments.length).toBe(1);
    expect(
      payments.some(
        (pay) => pay.fromPlayerId === "c" || pay.toPlayerId === "c",
      ),
    ).toBe(false);
  });

  it("returns positive integer amounts with distinct from/to in every payment", () => {
    const players = [
      p("a", 0, 100, 100),
      p("b", 50, 0, 200),
      p("c", 50, 0, 300),
    ];
    const payments = computeSettlement(players);
    for (const pay of payments) {
      expect(Number.isInteger(pay.amountCents)).toBe(true);
      expect(pay.amountCents).toBeGreaterThan(0);
      expect(pay.fromPlayerId).not.toBe(pay.toPlayerId);
    }
  });
});

describe("computeSettlement — shortfall absorption", () => {
  it("reproduces the worked example from docs/07-business-logic.md (A→B for 9800¢)", () => {
    // A bought in $100, cashed out $0; B bought in $100, cashed out $198.
    // Total buy-in 20000¢, cash-out 19800¢, shortfall 200¢ (1%).
    // After absorption: A = -9800, B = +9800. One payment A→B for 9800.
    const players = [p("a", 10000, 0, 100), p("b", 10000, 19800, 200)];
    expect(computeSettlement(players)).toEqual([
      { fromPlayerId: "a", toPlayerId: "b", amountCents: 9800 },
    ]);
  });

  it("absorbs a shortfall at exactly 2% (boundary)", () => {
    const players = [p("a", 10000, 0, 100), p("b", 0, 9800, 200)];
    // shortfall = 200 = 2% of 10000.
    // total_debt = 10000. A reduction = round((10000/10000)*200) = 200.
    // A becomes -9800. B = +9800. Sum = 0.
    expect(computeSettlement(players)).toEqual([
      { fromPlayerId: "a", toPlayerId: "b", amountCents: 9800 },
    ]);
  });

  it("is a no-op for zero-shortfall inputs (skips absorption)", () => {
    // Total buy-in equals total cash-out → shortfall = 0 → no absorption.
    const players = [p("a", 5000, 8000, 100), p("b", 5000, 2000, 200)];
    expect(computeSettlement(players)).toEqual([
      { fromPlayerId: "b", toPlayerId: "a", amountCents: 3000 },
    ]);
  });

  it("distributes a 1¢ rounding residual by smallest abs net first, then createdAtMs ASC", () => {
    // Construction: A creditor +3, B debtor -3, C debtor -3 (createdAtMs 200/300).
    // Total buy-in 10, total cash-out 7, shortfall 3, total debt 6.
    // B reduction = round((3/6)*3) = round(1.5) = 2 → B = -1.
    // C reduction = round((3/6)*3) = round(1.5) = 2 → C = -1.
    // Sum = +3 - 1 - 1 = +1 (residual).
    // Smallest abs (both at 1, tied) → tie-break createdAtMs ASC → B (200) wins.
    // B -= 1 → B = -2. Sum = 0.
    // Greedy: A creditor +3. Sorted debtors: B(-2) before C(-1). B→A 2, C→A 1.
    const players = [p("a", 0, 3, 100), p("b", 5, 2, 200), p("c", 5, 2, 300)];
    expect(computeSettlement(players)).toEqual([
      { fromPlayerId: "b", toPlayerId: "a", amountCents: 2 },
      { fromPlayerId: "c", toPlayerId: "a", amountCents: 1 },
    ]);
  });
});

describe("computeSettlement — deterministic tie-breaks", () => {
  it("orders tied debtors by createdAtMs ASC", () => {
    // Two debtors with identical net. Earlier createdAtMs sorts first
    // and is the source of the first emitted payment.
    const players = [
      p("a", 0, 40, 100),
      p("late", 20, 0, 300), // tied debt, later creation
      p("early", 20, 0, 200), // tied debt, earlier creation
    ];
    const payments = computeSettlement(players);
    expect(payments.map((pay) => pay.fromPlayerId)).toEqual(["early", "late"]);
  });

  it("breaks createdAtMs ties by player id ASC", () => {
    const players = [
      p("creditor", 0, 40, 100),
      p("zebra", 20, 0, 200), // same createdAtMs as alpha
      p("alpha", 20, 0, 200),
    ];
    const payments = computeSettlement(players);
    expect(payments.map((pay) => pay.fromPlayerId)).toEqual(["alpha", "zebra"]);
  });

  it("orders tied creditors by createdAtMs ASC then id ASC", () => {
    const players = [
      p("debtor", 60, 0, 100),
      p("late-credit", 0, 30, 300),
      p("early-credit", 0, 30, 200),
    ];
    const payments = computeSettlement(players);
    expect(payments.map((pay) => pay.toPlayerId)).toEqual([
      "early-credit",
      "late-credit",
    ]);
  });
});

describe("computeSettlement — defensive guards", () => {
  it("throws when any player has cashOutCents === null", () => {
    expect(() =>
      computeSettlement([p("a", 5000, 2000), p("b", 5000, null)]),
    ).toThrow(/cashOutCents/);
  });

  it("throws when total cash-out exceeds total buy-in (overage)", () => {
    expect(() =>
      computeSettlement([p("a", 5000, 8000), p("b", 5000, 5000)]),
    ).toThrow(/total cash-out exceeds total buy-in/);
  });

  it("throws when a numeric input is not an integer", () => {
    expect(() =>
      computeSettlement([
        { id: "a", createdAtMs: 100, totalBuyInCents: 10.5, cashOutCents: 0 },
        { id: "b", createdAtMs: 200, totalBuyInCents: 10, cashOutCents: 20 },
      ]),
    ).toThrow(/integer/);
  });
});

describe("absorbShortfall (internal helper)", () => {
  it("produces nets that sum to exactly zero for the worked example", () => {
    const players = [p("a", 10000, 0, 100), p("b", 10000, 19800, 200)];
    const nets = __test__.absorbShortfall(players);
    expect(nets.reduce((s, n) => s + n.net, 0)).toBe(0);
    const byId = new Map(nets.map((n) => [n.id, n.net]));
    expect(byId.get("a")).toBe(-9800);
    expect(byId.get("b")).toBe(9800);
  });

  it("leaves nets unchanged when shortfall is zero", () => {
    const players = [p("a", 5000, 8000, 100), p("b", 5000, 2000, 200)];
    const nets = __test__.absorbShortfall(players);
    const byId = new Map(nets.map((n) => [n.id, n.net]));
    expect(byId.get("a")).toBe(3000);
    expect(byId.get("b")).toBe(-3000);
  });
});

// Minimal seeded LCG so the fuzz test is deterministic across runs.
function lcg(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x1_0000_0000;
  };
}

function generateValidInput(rand: () => number): PlayerInput[] {
  const n = 1 + Math.floor(rand() * 10); // 1..10 players
  const buyIns: number[] = [];
  let totalBuyIn = 0;
  for (let i = 0; i < n; i++) {
    const buyIn = 100 + Math.floor(rand() * 2_000_000); // ≥ $1 to keep totals stable
    buyIns.push(buyIn);
    totalBuyIn += buyIn;
  }
  const minCashOut = Math.floor(0.98 * totalBuyIn);
  const span = totalBuyIn - minCashOut;
  const totalCashOut = minCashOut + Math.floor(rand() * (span + 1));
  const cashOuts: number[] = [];
  let remaining = totalCashOut;
  for (let i = 0; i < n - 1; i++) {
    const share = Math.floor(rand() * (remaining + 1));
    cashOuts.push(share);
    remaining -= share;
  }
  cashOuts.push(remaining);
  return buyIns.map((buyIn, i) => ({
    id: `p${i}`,
    createdAtMs: 1000 + i,
    totalBuyInCents: buyIn,
    cashOutCents: cashOuts[i] ?? 0,
  }));
}

describe("computeSettlement — seeded fuzz invariants (N=1000)", () => {
  it("payments are positive integers, ≤ N−1, and per-player flow matches adjusted net", () => {
    const rand = lcg(1);
    let totalRuns = 0;
    for (let iter = 0; iter < 1000; iter++) {
      const players = generateValidInput(rand);
      const adjustedNets = __test__.absorbShortfall(players);
      const adjustedById = new Map(adjustedNets.map((n) => [n.id, n.net]));
      const payments = computeSettlement(players);

      // (b) payments.length ≤ players.length − 1 (zero is fine for trivial inputs).
      expect(payments.length).toBeLessThanOrEqual(
        Math.max(0, players.length - 1),
      );

      // (c) every amount is a positive integer; from ≠ to.
      for (const pay of payments) {
        expect(Number.isInteger(pay.amountCents)).toBe(true);
        expect(pay.amountCents).toBeGreaterThan(0);
        expect(pay.fromPlayerId).not.toBe(pay.toPlayerId);
      }

      // (a) per-player net flow equals the post-absorption adjusted net.
      const flow = flowByPlayer(players, payments);
      for (const player of players) {
        expect(flow.get(player.id)).toBe(adjustedById.get(player.id));
      }

      totalRuns++;
    }
    expect(totalRuns).toBe(1000);
  });
});
