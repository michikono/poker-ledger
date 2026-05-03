import type { Payment, PlayerInput } from "./types";

type NetEntry = {
  id: string;
  createdAtMs: number;
  net: number;
};

export function computeSettlement(players: PlayerInput[]): Payment[] {
  assertValidInput(players);
  if (players.length === 0) return [];
  const adjustedNets = absorbShortfall(players);
  return greedyMatch(adjustedNets);
}

function assertValidInput(players: PlayerInput[]): void {
  for (const player of players) {
    if (player.cashOutCents === null) {
      throw new Error(
        `computeSettlement: cashOutCents must not be null (player ${player.id}); call validateSettling first`,
      );
    }
    if (
      !Number.isInteger(player.totalBuyInCents) ||
      !Number.isInteger(player.cashOutCents) ||
      !Number.isInteger(player.createdAtMs)
    ) {
      throw new Error(
        `computeSettlement: numeric inputs must be integers (player ${player.id})`,
      );
    }
  }
}

function absorbShortfall(players: PlayerInput[]): NetEntry[] {
  const nets: NetEntry[] = players.map((player) => ({
    id: player.id,
    createdAtMs: player.createdAtMs,
    net: (player.cashOutCents ?? 0) - player.totalBuyInCents,
  }));

  let totalBuyIn = 0;
  let totalCashOut = 0;
  for (const player of players) {
    totalBuyIn += player.totalBuyInCents;
    totalCashOut += player.cashOutCents ?? 0;
  }
  const shortfall = totalBuyIn - totalCashOut;

  if (shortfall < 0) {
    throw new Error(
      "computeSettlement: total cash-out exceeds total buy-in; validate before calling",
    );
  }

  if (shortfall > 0) {
    let totalDebt = 0;
    for (const entry of nets) {
      if (entry.net < 0) totalDebt += -entry.net;
    }
    if (totalDebt === 0) {
      // Mathematically unreachable when shortfall > 0 (sum(net) = -shortfall < 0
      // requires at least one negative net), but asserted defensively.
      throw new Error(
        "computeSettlement: shortfall > 0 but no debtors — invariant violated",
      );
    }
    for (const entry of nets) {
      if (entry.net < 0) {
        const reduction = Math.round((-entry.net / totalDebt) * shortfall);
        entry.net += reduction;
      }
    }
    distributeRoundingResidual(nets);
  }

  let finalSum = 0;
  for (const entry of nets) finalSum += entry.net;
  if (finalSum !== 0) {
    throw new Error("settlement-sum-to-zero violated");
  }
  return nets;
}

function distributeRoundingResidual(nets: NetEntry[]): void {
  let residual = 0;
  for (const entry of nets) residual += entry.net;
  // Bound iterations as a safety net; |residual| should be ≤ N/2 in practice.
  const maxIterations = nets.length * nets.length + 1;
  let iterations = 0;
  while (residual !== 0) {
    if (iterations++ > maxIterations) {
      throw new Error("computeSettlement: rounding residual did not converge");
    }
    const debtors = nets.filter((entry) => entry.net < 0);
    debtors.sort((a, b) => {
      const absDiff = Math.abs(a.net) - Math.abs(b.net);
      if (absDiff !== 0) return absDiff;
      if (a.createdAtMs !== b.createdAtMs) {
        return a.createdAtMs - b.createdAtMs;
      }
      return compareString(a.id, b.id);
    });
    const target = debtors[0];
    if (!target) {
      throw new Error(
        "computeSettlement: cannot distribute rounding residual — no debtors remain",
      );
    }
    target.net += residual > 0 ? -1 : 1;
    residual = 0;
    for (const entry of nets) residual += entry.net;
  }
}

function greedyMatch(nets: NetEntry[]): Payment[] {
  const debtors = nets
    .filter((entry) => entry.net < 0)
    .map((entry) => ({ ...entry }))
    .sort(compareDebtors);
  const creditors = nets
    .filter((entry) => entry.net > 0)
    .map((entry) => ({ ...entry }))
    .sort(compareCreditors);

  const payments: Payment[] = [];
  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const debtor = debtors[i];
    const creditor = creditors[j];
    if (!debtor || !creditor) break;
    const amount = Math.min(-debtor.net, creditor.net);
    payments.push({
      fromPlayerId: debtor.id,
      toPlayerId: creditor.id,
      amountCents: amount,
    });
    debtor.net += amount;
    creditor.net -= amount;
    if (debtor.net === 0) i++;
    if (creditor.net === 0) j++;
  }
  return payments;
}

function compareDebtors(a: NetEntry, b: NetEntry): number {
  // Largest debt first → most-negative net first → ascending net.
  const netDiff = a.net - b.net;
  if (netDiff !== 0) return netDiff;
  if (a.createdAtMs !== b.createdAtMs) return a.createdAtMs - b.createdAtMs;
  return compareString(a.id, b.id);
}

function compareCreditors(a: NetEntry, b: NetEntry): number {
  // Largest credit first → descending net.
  const netDiff = b.net - a.net;
  if (netDiff !== 0) return netDiff;
  if (a.createdAtMs !== b.createdAtMs) return a.createdAtMs - b.createdAtMs;
  return compareString(a.id, b.id);
}

function compareString(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

export const __test__ = { absorbShortfall, greedyMatch };
