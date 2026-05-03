import { formatCents } from "@/lib/currency/format";

export type PlayerTotals = {
  totalBuyInCents: number;
  cashOutCents: number | null;
  netCents: number | null;
};

export function computePlayerTotals(
  buyIns: ReadonlyArray<{ amountCents: number }>,
  cashOutCents: number | null,
): PlayerTotals {
  const totalBuyInCents = buyIns.reduce((sum, b) => sum + b.amountCents, 0);
  const netCents =
    cashOutCents === null ? null : cashOutCents - totalBuyInCents;
  return { totalBuyInCents, cashOutCents, netCents };
}

export type SessionTotals = {
  totalBuyInCents: number;
  totalCashOutCents: number;
  shortfallCents: number;
};

export function computeSessionTotals(
  players: ReadonlyArray<{
    buyIns: ReadonlyArray<{ amountCents: number }>;
    cashOutCents: number | null;
  }>,
): SessionTotals {
  let totalBuyInCents = 0;
  let totalCashOutCents = 0;
  for (const p of players) {
    for (const b of p.buyIns) totalBuyInCents += b.amountCents;
    if (p.cashOutCents !== null) totalCashOutCents += p.cashOutCents;
  }
  return {
    totalBuyInCents,
    totalCashOutCents,
    shortfallCents: totalBuyInCents - totalCashOutCents,
  };
}

export type BalanceState = "balanced" | "out_of_range" | "no_buy_ins";

export function balanceState(totals: SessionTotals): BalanceState {
  if (totals.totalBuyInCents === 0) return "no_buy_ins";
  const { shortfallCents, totalBuyInCents } = totals;
  if (shortfallCents < 0) return "out_of_range";
  if (shortfallCents / totalBuyInCents > 0.02) return "out_of_range";
  return "balanced";
}

export type SettleReadiness = { ok: true } | { ok: false; reason: string };

export function settleReadiness(
  players: ReadonlyArray<{
    name: string;
    buyIns: ReadonlyArray<{ amountCents: number }>;
    cashOutCents: number | null;
  }>,
): SettleReadiness {
  if (players.length === 0) {
    return { ok: false, reason: "Add at least one player before settling." };
  }
  const missing = players.find((p) => p.cashOutCents === null);
  if (missing) {
    return {
      ok: false,
      reason: `${missing.name} is missing a cash-out.`,
    };
  }
  const totals = computeSessionTotals(players);
  if (totals.totalBuyInCents === 0) {
    return { ok: false, reason: "Add a buy-in before settling." };
  }
  if (totals.shortfallCents < 0) {
    return {
      ok: false,
      reason: `Cash-outs exceed buy-ins by ${formatCents(-totals.shortfallCents)}.`,
    };
  }
  if (totals.shortfallCents / totals.totalBuyInCents > 0.02) {
    return {
      ok: false,
      reason: `Shortfall of ${formatCents(totals.shortfallCents)} exceeds 2% of the pot.`,
    };
  }
  return { ok: true };
}
