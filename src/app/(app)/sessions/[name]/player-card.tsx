"use client";

import { Pencil } from "lucide-react";
import { type Ref, useImperativeHandle, useRef, useState } from "react";
import { VenmoIcon } from "@/components/icons/venmo-icon";
import { formatCents } from "@/lib/currency/format";
import type { SessionStatus } from "@/lib/sessions/types";
import { cn } from "@/lib/utils";
import type { SessionPlayerView } from "./page";
import { PlayerDetailsSheet } from "./player-details-sheet";
import type { PlayerRowHandle } from "./player-row";
import { computePlayerTotals } from "./totals";

/**
 * Mobile player card. Display-only — every edit (name, Venmo, buy-ins,
 * cash-out, delete) lives in the PlayerDetailsSheet that opens when the
 * card is tapped. This keeps the in-progress card uncluttered and ensures
 * editing is the same on mobile and desktop (where PlayerRow opens the
 * same sheet).
 */
export function PlayerCard({
  sessionId,
  status,
  player,
  ref,
}: {
  sessionId: string;
  status: SessionStatus;
  player: SessionPlayerView;
  ref?: Ref<PlayerRowHandle>;
}) {
  const editable = status === "in_progress";

  const cardRef = useRef<HTMLElement | null>(null);
  const [editing, setEditing] = useState(false);
  const [editFocus, setEditFocus] = useState<"name" | "venmo">("name");

  const totals = computePlayerTotals(
    player.buyIns.map((b) => ({ amountCents: b.amountCents })),
    player.cashOutCents,
  );

  useImperativeHandle(ref, () => ({
    openEdit: (options) => {
      if (status === "archived") return;
      setEditFocus(options?.focus ?? "name");
      setEditing(true);
      cardRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    },
  }));

  function openSheet() {
    setEditFocus("name");
    setEditing(true);
  }

  const netDisplay =
    totals.netCents === null
      ? "—"
      : totals.netCents === 0
        ? formatCents(0)
        : totals.netCents > 0
          ? `+${formatCents(totals.netCents)}`
          : formatCents(totals.netCents);

  const cashOutDisplay =
    player.cashOutCents === null ? "—" : formatCents(player.cashOutCents);

  return (
    <article
      ref={cardRef}
      data-testid={`player-card-${player.id}`}
      className="rounded-lg border bg-card shadow-sm"
    >
      <button
        type="button"
        onClick={openSheet}
        aria-label={
          editable ? `Edit ${player.name}` : `View details for ${player.name}`
        }
        data-testid={`player-card-name-${player.id}`}
        className="group flex w-full flex-col gap-3 rounded-lg p-3 text-left transition-colors hover:bg-muted/30 focus-visible:bg-muted/30 focus-visible:outline-none"
      >
        {/* 1. Player name + tap-to-edit hint */}
        <header className="flex items-center justify-between gap-2">
          <span className="flex min-w-0 items-center gap-1.5 text-base font-medium">
            <span className="truncate underline-offset-4 group-hover:underline">
              {player.name}
            </span>
            {player.venmoUsername && (
              <VenmoIcon
                size={16}
                className="shrink-0 opacity-90"
                title={`Venmo: @${player.venmoUsername}`}
              />
            )}
          </span>
          <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
            <Pencil aria-hidden="true" className="size-3.5" />
            {editable ? "Tap to edit" : "Tap for details"}
          </span>
        </header>

        {/* 2. Buy-ins */}
        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1.5">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Buy-ins
          </span>
          {player.buyIns.length === 0 ? (
            <span className="text-xs text-muted-foreground">None yet.</span>
          ) : (
            player.buyIns.map((b) => (
              <span
                key={b.id}
                className="inline-flex items-center rounded-full bg-muted px-2.5 py-1 text-sm tabular-nums"
                data-testid={`buy-in-${b.id}`}
              >
                {formatCents(b.amountCents)}
              </span>
            ))
          )}
        </div>

        {/* 3. Total in / Cash out / Net */}
        <dl className="grid grid-cols-3 gap-3">
          <div className="flex flex-col gap-0.5">
            <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Total in
            </dt>
            <dd className="text-base font-medium tabular-nums">
              {formatCents(totals.totalBuyInCents)}
            </dd>
          </div>
          <div className="flex flex-col gap-0.5">
            <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Cash out
            </dt>
            <dd
              className="text-base font-medium tabular-nums"
              data-testid={`cash-out-${player.id}`}
            >
              {cashOutDisplay}
            </dd>
          </div>
          <div className="flex flex-col gap-0.5">
            <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Net
            </dt>
            <dd
              className={cn(
                "text-base font-medium tabular-nums",
                totals.netCents !== null &&
                  totals.netCents < 0 &&
                  "text-destructive",
              )}
            >
              {netDisplay}
            </dd>
          </div>
        </dl>
      </button>

      <PlayerDetailsSheet
        open={editing}
        onOpenChange={setEditing}
        sessionId={sessionId}
        status={status}
        player={player}
        initialFocus={editFocus}
      />
    </article>
  );
}
