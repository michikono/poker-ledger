/**
 * One buy-in event (add or remove) for a single player, derived from the
 * session change_log. Used for the read-only per-player history in the
 * Buy-ins modal. Defined here (not in page.tsx) so the grouping helper can be
 * unit-tested without pulling in server-only Firestore imports.
 */
export type BuyInHistoryEntry = {
  id: string;
  kind: "added" | "removed";
  amountCents: number;
  actorName: string;
  createdAt: string;
};

/** A change_log entry, already normalized from its Firestore document. */
export type RawLogEntry = {
  id: string;
  actionType: string;
  actorName: string;
  createdAt: string;
  metadata: Record<string, unknown>;
};

/**
 * Group buy-in add/remove events by player. Input order is preserved per
 * player (callers pass newest-first), and non-buy-in events or entries without
 * a string `player_id` are ignored.
 */
export function groupBuyInHistory(
  entries: RawLogEntry[],
): Record<string, BuyInHistoryEntry[]> {
  const byPlayer: Record<string, BuyInHistoryEntry[]> = {};
  for (const entry of entries) {
    if (
      entry.actionType !== "buy_in_added" &&
      entry.actionType !== "buy_in_removed"
    ) {
      continue;
    }
    const playerId = entry.metadata.player_id;
    if (typeof playerId !== "string") continue;
    const list = byPlayer[playerId] ?? [];
    list.push({
      id: entry.id,
      kind: entry.actionType === "buy_in_added" ? "added" : "removed",
      amountCents:
        typeof entry.metadata.amount_cents === "number"
          ? entry.metadata.amount_cents
          : 0,
      actorName: entry.actorName,
      createdAt: entry.createdAt,
    });
    byPlayer[playerId] = list;
  }
  return byPlayer;
}
