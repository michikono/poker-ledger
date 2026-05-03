import { describe, expect, it } from "vitest";
import type { PlayerInput } from "./types";
import { validateSettling } from "./validate";

function p(
  id: string,
  totalBuyInCents: number,
  cashOutCents: number | null,
  createdAtMs = 1000,
): PlayerInput {
  return { id, createdAtMs, totalBuyInCents, cashOutCents };
}

describe("validateSettling", () => {
  it("rejects an empty player list as INVALID_INPUT", () => {
    const result = validateSettling([]);
    expect(result).toEqual({ ok: false, code: "INVALID_INPUT" });
  });

  it("rejects when any player has cashOutCents === null", () => {
    const result = validateSettling([
      p("a", 10000, 5000),
      p("b", 10000, null),
      p("c", 10000, null),
    ]);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("INVALID_INPUT");
    expect(result.missingCashOutPlayerIds).toEqual(["b", "c"]);
  });

  it("treats cashOutCents === 0 as valid (player busted out)", () => {
    const result = validateSettling([p("a", 10000, 0), p("b", 10000, 20000)]);
    expect(result).toEqual({ ok: true });
  });

  it("rejects totalBuyInCents === 0 as BALANCE_OUT_OF_RANGE", () => {
    const result = validateSettling([p("a", 0, 0), p("b", 0, 0)]);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("BALANCE_OUT_OF_RANGE");
    expect(result.totalBuyInCents).toBe(0);
    expect(result.totalCashOutCents).toBe(0);
  });

  it("rejects when total cash-out exceeds total buy-in (overage)", () => {
    const result = validateSettling([p("a", 5000, 6000), p("b", 5000, 5000)]);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("BALANCE_OUT_OF_RANGE");
    expect(result.totalBuyInCents).toBe(10000);
    expect(result.totalCashOutCents).toBe(11000);
  });

  it("accepts a 0% shortfall (exact balance)", () => {
    const result = validateSettling([p("a", 5000, 3000), p("b", 5000, 7000)]);
    expect(result).toEqual({ ok: true });
  });

  it("accepts a 1.99% shortfall (just under tolerance)", () => {
    // total buy-in = 10000, shortfall = 199 → 1.99%
    const result = validateSettling([p("a", 5000, 0), p("b", 5000, 9801)]);
    expect(result).toEqual({ ok: true });
  });

  it("accepts a 2.00% shortfall (exact tolerance)", () => {
    // total buy-in = 10000, shortfall = 200 → 2.00%
    const result = validateSettling([p("a", 5000, 0), p("b", 5000, 9800)]);
    expect(result).toEqual({ ok: true });
  });

  it("rejects a 2.01% shortfall (just over tolerance)", () => {
    // total buy-in = 10000, shortfall = 201 → 2.01%
    const result = validateSettling([p("a", 5000, 0), p("b", 5000, 9799)]);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("BALANCE_OUT_OF_RANGE");
    expect(result.shortfallCents).toBe(201);
    expect(result.totalBuyInCents).toBe(10000);
    expect(result.totalCashOutCents).toBe(9799);
  });

  it("returns ok for a typical happy path", () => {
    const result = validateSettling([p("a", 10000, 0), p("b", 10000, 19800)]);
    expect(result).toEqual({ ok: true });
  });

  it("checks missing cash-outs before balance (INVALID_INPUT wins over BALANCE_OUT_OF_RANGE)", () => {
    // total buy-in = 10000, total cash-out (non-null) = 0 → would be 100% shortfall,
    // but we expect INVALID_INPUT because cash-outs are missing.
    const result = validateSettling([p("a", 5000, null), p("b", 5000, null)]);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("INVALID_INPUT");
    expect(result.missingCashOutPlayerIds).toEqual(["a", "b"]);
  });
});
