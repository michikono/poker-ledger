import type { PlayerInput, SettlingValidationResult } from "./types";

const SHORTFALL_TOLERANCE_NUMERATOR = 2;
const SHORTFALL_TOLERANCE_DENOMINATOR = 100;

export function validateSettling(
  players: PlayerInput[],
): SettlingValidationResult {
  if (players.length === 0) {
    return { ok: false, code: "INVALID_INPUT" };
  }

  const missingCashOutPlayerIds: string[] = [];
  for (const player of players) {
    if (player.cashOutCents === null) {
      missingCashOutPlayerIds.push(player.id);
    }
  }
  if (missingCashOutPlayerIds.length > 0) {
    return {
      ok: false,
      code: "INVALID_INPUT",
      missingCashOutPlayerIds,
    };
  }

  let totalBuyInCents = 0;
  let totalCashOutCents = 0;
  for (const player of players) {
    totalBuyInCents += player.totalBuyInCents;
    totalCashOutCents += player.cashOutCents ?? 0;
  }

  if (totalBuyInCents === 0) {
    return {
      ok: false,
      code: "BALANCE_OUT_OF_RANGE",
      shortfallCents: 0,
      totalBuyInCents,
      totalCashOutCents,
    };
  }

  if (totalCashOutCents > totalBuyInCents) {
    return {
      ok: false,
      code: "BALANCE_OUT_OF_RANGE",
      shortfallCents: totalBuyInCents - totalCashOutCents,
      totalBuyInCents,
      totalCashOutCents,
    };
  }

  const shortfallCents = totalBuyInCents - totalCashOutCents;
  const shortfallExceedsTolerance =
    shortfallCents * SHORTFALL_TOLERANCE_DENOMINATOR >
    SHORTFALL_TOLERANCE_NUMERATOR * totalBuyInCents;

  if (shortfallExceedsTolerance) {
    return {
      ok: false,
      code: "BALANCE_OUT_OF_RANGE",
      shortfallCents,
      totalBuyInCents,
      totalCashOutCents,
    };
  }

  return { ok: true };
}
