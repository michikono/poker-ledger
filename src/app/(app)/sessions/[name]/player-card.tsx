"use client";

import { Pencil, Plus } from "lucide-react";
import { type Ref, useImperativeHandle, useRef, useState } from "react";
import { VenmoIcon } from "@/components/icons/venmo-icon";
import { formatCents } from "@/lib/currency/format";
import type { SessionStatus } from "@/lib/sessions/types";
import { cn } from "@/lib/utils";
import { BuyInsModal } from "./buy-ins-modal";
import type { BuyInHistoryEntry, SessionPlayerView } from "./page";
import { PlayerDetailsSheet } from "./player-details-sheet";
import type { PlayerRowHandle } from "./player-row";
import { computePlayerTotals } from "./totals";
import { useFlashOnChange } from "./use-flash-on-change";

/**
 * Mobile player card. Tapping the body opens the PlayerDetailsSheet (name,
 * Venmo, cash-out, delete). Buy-ins are added/removed in their own modal,
 * reached via the trailing "+" strip — kept separate from the profile editor
 * so the most frequent action (recording a buy-in) is one tap from the roster.
 */
export function PlayerCard({
  sessionId,
  status,
  player,
  defaultBuyInCents,
  buyInHistory,
  highlighted,
  onPlayerChanged,
  ref,
}: {
  sessionId: string;
  status: SessionStatus;
  player: SessionPlayerView;
  defaultBuyInCents: number | null;
  buyInHistory: BuyInHistoryEntry[];
  highlighted?: boolean;
  onPlayerChanged?: (playerId: string) => void;
  ref?: Ref<PlayerRowHandle>;
}) {
  const editable = status === "in_progress";

  const cardRef = useRef<HTMLElement | null>(null);
  const [editing, setEditing] = useState(false);
  const [editFocus, setEditFocus] = useState<"name" | "venmo">("name");
  const [buyInsOpen, setBuyInsOpen] = useState(false);

  const totals = computePlayerTotals(
    player.buyIns.map((b) => ({ amountCents: b.amountCents })),
    player.cashOutCents,
  );

  // Replay the flash animation whenever the parent says this player just
  // changed (added, renamed, etc).
  useFlashOnChange(cardRef, highlighted);

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

  // `—` (em-dash) is the tabular-empty placeholder for money cells.
  // Intentional financial-UI convention, not the punctuation em-dash
  // banned in user-facing prose copy.
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
      className="flex items-stretch overflow-hidden rounded-lg border bg-card shadow-sm"
    >
      <button
        type="button"
        onClick={openSheet}
        aria-label={
          editable ? `Edit ${player.name}` : `View details for ${player.name}`
        }
        data-testid={`player-card-name-${player.id}`}
        className="group flex flex-1 flex-col gap-3 p-3 text-left transition-colors hover:bg-muted/30 focus-visible:bg-muted/30 focus-visible:outline-none"
      >
        {/* 1. Player name with the edit hint directly beneath it, so the hint
            clearly refers to opening the editor (the "Buy in" strip is on the
            far right and labels itself). */}
        <header className="flex flex-col gap-0.5">
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
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
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
                totals.netCents !== null && totals.netCents < 0 && "text-loss",
              )}
            >
              {netDisplay}
            </dd>
          </div>
        </dl>
      </button>

      {/* Trailing full-height "Buy in" strip: the one-tap path to add a buy-in.
          A sibling of the edit button (not nested) so its taps never open the
          edit sheet. Labeled (icon + "Buy in") so it's unmistakable. Only while
          buy-ins are editable (in_progress). */}
      {editable && (
        <button
          type="button"
          onClick={() => setBuyInsOpen(true)}
          aria-label={`Add buy-in for ${player.name}`}
          data-testid={`pbi-open-${player.id}`}
          className="flex w-16 shrink-0 flex-col items-center justify-center gap-0.5 border-l border-border text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground focus-visible:bg-muted/50 focus-visible:text-foreground focus-visible:outline-none active:bg-muted"
        >
          <Plus className="size-5" />
          <span className="text-[11px] font-medium leading-none">Buy in</span>
        </button>
      )}

      <PlayerDetailsSheet
        open={editing}
        onOpenChange={setEditing}
        sessionId={sessionId}
        status={status}
        player={player}
        initialFocus={editFocus}
        {...(onPlayerChanged ? { onPlayerChanged } : {})}
      />

      {editable && (
        <BuyInsModal
          open={buyInsOpen}
          onOpenChange={setBuyInsOpen}
          sessionId={sessionId}
          player={player}
          defaultBuyInCents={defaultBuyInCents}
          history={buyInHistory}
          {...(onPlayerChanged ? { onPlayerChanged } : {})}
        />
      )}
    </article>
  );
}
