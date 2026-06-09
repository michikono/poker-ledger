"use client";

import { Pencil, Plus } from "lucide-react";
import {
  type Ref,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { VenmoIcon } from "@/components/icons/venmo-icon";
import { Button } from "@/components/ui/button";
import { formatCents } from "@/lib/currency/format";
import type { SessionStatus } from "@/lib/sessions/types";
import { cn } from "@/lib/utils";
import { BuyInsModal } from "./buy-ins-modal";
import type { BuyInHistoryEntry, SessionPlayerView } from "./page";
import { PlayerDetailsSheet } from "./player-details-sheet";
import { computePlayerTotals } from "./totals";

export type PlayerRowHandle = {
  openEdit: (options?: { focus?: "name" | "venmo" }) => void;
};

/**
 * Desktop player row. Display-only — same model as PlayerCard on mobile.
 * Clicking the row anywhere opens the PlayerDetailsSheet which owns every
 * edit (name, Venmo, buy-ins, cash-out, delete).
 */
export function PlayerRow({
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

  const rowRef = useRef<HTMLTableRowElement | null>(null);
  const [editing, setEditing] = useState(false);
  const [editFocus, setEditFocus] = useState<"name" | "venmo">("name");
  const [buyInsOpen, setBuyInsOpen] = useState(false);

  const totals = computePlayerTotals(
    player.buyIns.map((b) => ({ amountCents: b.amountCents })),
    player.cashOutCents,
  );

  // Replay the flash animation when the parent says this row just changed.
  useEffect(() => {
    if (!highlighted) return;
    const el = rowRef.current;
    if (!el) return;
    el.classList.remove("player-row-flash");
    void el.offsetWidth;
    el.classList.add("player-row-flash");
  }, [highlighted]);

  useImperativeHandle(ref, () => ({
    openEdit: (options) => {
      setEditFocus(options?.focus ?? "name");
      setEditing(true);
      rowRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    },
  }));

  function openSheet(focus: "name" | "venmo" = "name") {
    setEditFocus(focus);
    setEditing(true);
  }

  return (
    <tr
      ref={rowRef}
      className="cursor-pointer border-t hover:bg-muted/30"
      // The sheet below renders through a React Portal. Portals keep React's
      // synthetic event bubbling along the COMPONENT tree (not the DOM tree),
      // so a click/keypress inside the sheet bubbles up to this row. Without a
      // guard, dismissing the sheet (Cancel button, backdrop click) would
      // immediately re-open it via openSheet — the user could never close it.
      // A genuine row interaction has its target inside this <tr>; a bubbled
      // event from the portaled sheet does not (its DOM lives under <body>).
      onClick={(e) => {
        if (!e.currentTarget.contains(e.target as Node)) return;
        openSheet("name");
      }}
      onKeyDown={(e) => {
        if (!e.currentTarget.contains(e.target as Node)) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openSheet("name");
        }
      }}
      tabIndex={0}
      aria-label={
        editable ? `Edit ${player.name}` : `View details for ${player.name}`
      }
      data-testid={`player-row-${player.id}`}
    >
      <td className="p-3">
        <span className="group flex items-center gap-1.5 text-left font-medium">
          <span className="underline-offset-4 group-hover:underline">
            {player.name}
          </span>
          {player.venmoUsername && (
            <VenmoIcon
              size={14}
              className="shrink-0 opacity-90"
              title={`Venmo: @${player.venmoUsername}`}
            />
          )}
          <Pencil
            aria-hidden="true"
            className="size-3 shrink-0 text-muted-foreground"
          />
        </span>
      </td>

      <td className="p-3">
        <div className="flex items-center justify-between gap-2">
          {player.buyIns.length === 0 ? (
            <span className="text-xs text-muted-foreground">None yet.</span>
          ) : (
            <div className="flex flex-wrap items-center gap-1">
              {player.buyIns.map((b) => (
                <span
                  key={b.id}
                  className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs tabular-nums"
                  data-testid={`buy-in-${b.id}`}
                >
                  {formatCents(b.amountCents)}
                </span>
              ))}
            </div>
          )}
          {editable && (
            // Buy-ins open in their own modal. stopPropagation so this click
            // (which is inside the row) doesn't also trigger the row's
            // open-edit handler.
            <Button
              type="button"
              size="icon-sm"
              variant="outline"
              onClick={(e) => {
                e.stopPropagation();
                setBuyInsOpen(true);
              }}
              onKeyDown={(e) => e.stopPropagation()}
              aria-label={`Add buy-in for ${player.name}`}
              data-testid={`pbi-open-${player.id}`}
              className="shrink-0"
            >
              <Plus className="size-4" />
            </Button>
          )}
        </div>
      </td>

      <td className="p-3 text-right tabular-nums">
        {formatCents(totals.totalBuyInCents)}
      </td>

      <td
        className="p-3 text-right tabular-nums"
        data-testid={`cash-out-${player.id}`}
      >
        {/* `—` (em-dash) is the tabular-empty placeholder for money cells.
            Intentional financial-UI convention, not the punctuation em-dash
            banned in user-facing prose copy. */}
        {player.cashOutCents === null ? "—" : formatCents(player.cashOutCents)}
      </td>

      <td
        className={cn(
          "p-3 text-right tabular-nums",
          totals.netCents !== null && totals.netCents < 0 && "text-loss",
        )}
      >
        {totals.netCents === null
          ? "—"
          : totals.netCents === 0
            ? formatCents(0)
            : totals.netCents > 0
              ? `+${formatCents(totals.netCents)}`
              : formatCents(totals.netCents)}
      </td>

      {/* The sheet's DOM renders through a Portal (under <body>), but React
          synthetic events still bubble up this component tree to the row's
          handlers — which is why those handlers guard on currentTarget.contains
          (see onClick/onKeyDown above) so dismissing the sheet can't re-open it. */}
      <td className="hidden">
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
      </td>
    </tr>
  );
}
