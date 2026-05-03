import { describe, expect, it } from "vitest";
import {
  balanceState,
  computePlayerTotals,
  computeSessionTotals,
  settleReadiness,
} from "./totals";

describe("computePlayerTotals", () => {
  it("sums buy-ins and computes net when cash-out is set", () => {
    expect(
      computePlayerTotals(
        [{ amountCents: 5000 }, { amountCents: 2500 }],
        10000,
      ),
    ).toEqual({ totalBuyInCents: 7500, cashOutCents: 10000, netCents: 2500 });
  });

  it("returns null net when cash-out is null", () => {
    expect(computePlayerTotals([{ amountCents: 5000 }], null)).toEqual({
      totalBuyInCents: 5000,
      cashOutCents: null,
      netCents: null,
    });
  });

  it("returns 0 totals for no buy-ins", () => {
    expect(computePlayerTotals([], 0)).toEqual({
      totalBuyInCents: 0,
      cashOutCents: 0,
      netCents: 0,
    });
  });
});

describe("computeSessionTotals", () => {
  it("sums across players, treating null cash-outs as 0 in totals", () => {
    const result = computeSessionTotals([
      { buyIns: [{ amountCents: 5000 }], cashOutCents: 5000 },
      { buyIns: [{ amountCents: 5000 }], cashOutCents: null },
    ]);
    expect(result).toEqual({
      totalBuyInCents: 10000,
      totalCashOutCents: 5000,
      shortfallCents: 5000,
    });
  });

  it("computes negative shortfall when cash-outs exceed buy-ins", () => {
    const result = computeSessionTotals([
      { buyIns: [{ amountCents: 5000 }], cashOutCents: 7000 },
    ]);
    expect(result.shortfallCents).toBe(-2000);
  });
});

describe("balanceState", () => {
  it("is no_buy_ins when total buy-in is zero", () => {
    expect(
      balanceState({
        totalBuyInCents: 0,
        totalCashOutCents: 0,
        shortfallCents: 0,
      }),
    ).toBe("no_buy_ins");
  });

  it("is out_of_range when shortfall is negative (cash-out > buy-in)", () => {
    expect(
      balanceState({
        totalBuyInCents: 10000,
        totalCashOutCents: 11000,
        shortfallCents: -1000,
      }),
    ).toBe("out_of_range");
  });

  it("is out_of_range when shortfall exceeds 2%", () => {
    expect(
      balanceState({
        totalBuyInCents: 10000,
        totalCashOutCents: 9700,
        shortfallCents: 300,
      }),
    ).toBe("out_of_range");
  });

  it("is balanced when shortfall is exactly 2%", () => {
    expect(
      balanceState({
        totalBuyInCents: 10000,
        totalCashOutCents: 9800,
        shortfallCents: 200,
      }),
    ).toBe("balanced");
  });

  it("is balanced when shortfall is zero", () => {
    expect(
      balanceState({
        totalBuyInCents: 10000,
        totalCashOutCents: 10000,
        shortfallCents: 0,
      }),
    ).toBe("balanced");
  });
});

describe("settleReadiness", () => {
  it("rejects when no players", () => {
    expect(settleReadiness([])).toEqual({
      ok: false,
      reason: expect.stringContaining("at least one player"),
    });
  });

  it("rejects when a player has null cash-out", () => {
    const result = settleReadiness([
      { name: "Alice", buyIns: [{ amountCents: 5000 }], cashOutCents: 5000 },
      { name: "Bob", buyIns: [{ amountCents: 5000 }], cashOutCents: null },
    ]);
    expect(result).toEqual({
      ok: false,
      reason: expect.stringContaining("Bob"),
    });
  });

  it("rejects when total buy-in is zero", () => {
    const result = settleReadiness([
      { name: "Alice", buyIns: [], cashOutCents: 0 },
    ]);
    expect(result).toEqual({
      ok: false,
      reason: expect.stringContaining("buy-in before settling"),
    });
  });

  it("rejects when cash-outs exceed buy-ins", () => {
    const result = settleReadiness([
      { name: "Alice", buyIns: [{ amountCents: 5000 }], cashOutCents: 7000 },
    ]);
    expect(result).toEqual({
      ok: false,
      reason: expect.stringContaining("exceed buy-ins"),
    });
  });

  it("rejects when shortfall > 2%", () => {
    const result = settleReadiness([
      { name: "Alice", buyIns: [{ amountCents: 10000 }], cashOutCents: 9700 },
    ]);
    expect(result).toEqual({
      ok: false,
      reason: expect.stringContaining("exceeds 2%"),
    });
  });

  it("accepts a balanced session", () => {
    expect(
      settleReadiness([
        {
          name: "Alice",
          buyIns: [{ amountCents: 10000 }],
          cashOutCents: 12000,
        },
        { name: "Bob", buyIns: [{ amountCents: 10000 }], cashOutCents: 8000 },
      ]),
    ).toEqual({ ok: true });
  });

  it("accepts a session with shortfall exactly at 2%", () => {
    expect(
      settleReadiness([
        { name: "Alice", buyIns: [{ amountCents: 10000 }], cashOutCents: 9800 },
      ]),
    ).toEqual({ ok: true });
  });
});
