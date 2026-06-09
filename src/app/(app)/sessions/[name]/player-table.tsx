"use client";

import { formatCents } from "@/lib/currency/format";
import type { SessionStatus } from "@/lib/sessions/types";
import type { SessionPlayerView } from "./page";
import { PlayerRow, type PlayerRowHandle } from "./player-row";
import type { SessionTotals } from "./totals";

export function PlayerTable({
  sessionId,
  status,
  players,
  defaultBuyInCents,
  totals,
  highlightedId,
  onPlayerChanged,
  playerRowsRef,
}: {
  sessionId: string;
  status: SessionStatus;
  players: SessionPlayerView[];
  defaultBuyInCents: number | null;
  totals: SessionTotals;
  highlightedId?: string | null;
  onPlayerChanged?: (playerId: string) => void;
  playerRowsRef?: { current: Map<string, PlayerRowHandle> };
}) {
  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full text-sm">
        <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
          <tr>
            <th className="p-3">Player</th>
            <th className="p-3">Buy-ins</th>
            <th className="p-3 text-right">Total in</th>
            <th className="p-3 text-right">Cash out</th>
            <th className="p-3 text-right">Net</th>
          </tr>
        </thead>
        <tbody>
          {players.map((p) => (
            <PlayerRow
              key={p.id}
              sessionId={sessionId}
              status={status}
              player={p}
              defaultBuyInCents={defaultBuyInCents}
              highlighted={highlightedId === p.id}
              {...(onPlayerChanged ? { onPlayerChanged } : {})}
              ref={(handle) => {
                if (!playerRowsRef) return;
                if (handle) {
                  playerRowsRef.current.set(p.id, handle);
                } else {
                  playerRowsRef.current.delete(p.id);
                }
              }}
            />
          ))}
        </tbody>
        <tfoot className="border-t bg-muted/30">
          <tr>
            <td className="p-3 font-medium">Totals</td>
            <td className="p-3" />
            <td className="p-3 text-right font-medium">
              {formatCents(totals.totalBuyInCents)}
            </td>
            <td className="p-3 text-right font-medium">
              {formatCents(totals.totalCashOutCents)}
            </td>
            <td className="p-3 text-right font-medium">
              {totals.shortfallCents === 0
                ? "Balanced"
                : totals.shortfallCents > 0
                  ? `${formatCents(totals.shortfallCents)} short`
                  : `${formatCents(-totals.shortfallCents)} over`}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
