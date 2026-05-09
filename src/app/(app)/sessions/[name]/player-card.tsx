"use client";

import { Loader2, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { type Ref, useImperativeHandle, useRef, useState } from "react";
import { VenmoIcon } from "@/components/icons/venmo-icon";
import { Button } from "@/components/ui/button";
import { CurrencyInput } from "@/components/ui/currency-input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { withToken } from "@/lib/auth/client-token";
import { formatCents } from "@/lib/currency/format";
import { parseDollars } from "@/lib/currency/parse";
import { describeErrorCode } from "@/lib/errors/messages";
import type { SessionStatus } from "@/lib/sessions/types";
import { cn } from "@/lib/utils";
import { setCashOut } from "./actions";
import { AddBuyInModal } from "./add-buy-in-modal";
import type { SessionPlayerView } from "./page";
import { PlayerDetailsSheet } from "./player-details-sheet";
import type { PlayerRowHandle } from "./player-row";
import { computePlayerTotals } from "./totals";

type CashOutError =
  | { kind: "validation"; message: string }
  | { kind: "generic"; message: string; retry: () => void }
  | null;

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
  const router = useRouter();
  const editable = status === "in_progress";

  const cardRef = useRef<HTMLElement | null>(null);
  const [editing, setEditing] = useState(false);
  const [editFocus, setEditFocus] = useState<"name" | "venmo">("name");
  const [addingBuyIn, setAddingBuyIn] = useState(false);

  const [cashOutDraft, setCashOutDraft] = useState(
    player.cashOutCents === null ? "" : (player.cashOutCents / 100).toFixed(2),
  );
  const [cashOutError, setCashOutError] = useState<CashOutError>(null);
  const [cashOutBusy, setCashOutBusy] = useState(false);

  const totals = computePlayerTotals(
    player.buyIns.map((b) => ({ amountCents: b.amountCents })),
    player.cashOutCents,
  );

  function flashCard() {
    const el = cardRef.current;
    if (!el) return;
    el.classList.remove("player-row-flash");
    void el.offsetWidth;
    el.classList.add("player-row-flash");
  }

  useImperativeHandle(ref, () => ({
    openEdit: (options) => {
      if (status === "archived") return;
      setEditFocus(options?.focus ?? "name");
      setEditing(true);
      cardRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    },
  }));

  function openSheet(focus: "name" | "venmo" = "name") {
    if (status === "archived" && !editable) {
      // archived sessions still allow viewing details (read-only sheet).
    }
    setEditFocus(focus);
    setEditing(true);
  }

  async function commitCashOut() {
    if (cashOutBusy) return;
    setCashOutError(null);

    let target: number | null;
    const trimmed = cashOutDraft.trim();
    if (trimmed === "") {
      target = null;
    } else {
      const cents = parseDollars(trimmed);
      if (cents === null || cents < 0 || cents > 2_000_000) {
        setCashOutError({
          kind: "validation",
          message: "Enter a valid amount, e.g., 25 or 25.00.",
        });
        return;
      }
      target = cents;
    }

    if (target === player.cashOutCents) return;

    setCashOutBusy(true);
    const result = await withToken((token) =>
      setCashOut(
        { sessionId, playerId: player.id, amountCents: target },
        token,
      ),
    );
    setCashOutBusy(false);
    if (!result) return;
    if (result.success) {
      flashCard();
      router.refresh();
      return;
    }
    setCashOutError({
      kind: "generic",
      message: describeErrorCode(result.error.code),
      retry: () => {
        void commitCashOut();
      },
    });
  }

  const netDisplay =
    totals.netCents === null
      ? "—"
      : totals.netCents === 0
        ? formatCents(0)
        : totals.netCents > 0
          ? `+${formatCents(totals.netCents)}`
          : formatCents(totals.netCents);

  return (
    <article
      ref={cardRef}
      data-testid={`player-card-${player.id}`}
      className="flex flex-col gap-3 rounded-lg border bg-card p-3 shadow-sm"
    >
      <header className="flex items-center gap-2">
        <button
          type="button"
          className="group flex min-w-0 flex-1 flex-col items-start gap-0.5 rounded-md py-1 text-left disabled:cursor-default"
          onClick={() => openSheet("name")}
          disabled={status === "archived"}
          aria-label={`Edit ${player.name}`}
          data-testid={`player-card-name-${player.id}`}
        >
          <span className="flex max-w-full items-center gap-1.5 text-base font-medium">
            <span className="truncate underline-offset-4 group-enabled:group-hover:underline">
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
          {status !== "archived" && (
            <span className="text-xs text-muted-foreground">
              Tap to edit player
            </span>
          )}
        </button>
        {editable && (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`More actions for ${player.name}`}
                  data-testid={`player-card-more-${player.id}`}
                />
              }
            >
              <MoreHorizontal className="size-5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => openSheet("name")}>
                <Pencil className="size-4" />
                Edit player
              </DropdownMenuItem>
              <DropdownMenuItem
                variant="destructive"
                onClick={() => openSheet("name")}
                aria-label="Delete player (opens player details)"
              >
                <Trash2 className="size-4" />
                Delete player…
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </header>

      <dl className="grid grid-cols-3 gap-3 text-sm">
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
          <dd>
            {editable ? (
              <div className="relative">
                <CurrencyInput
                  placeholder="—"
                  value={cashOutDraft}
                  onChange={setCashOutDraft}
                  onBlur={() => void commitCashOut()}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      (e.currentTarget as HTMLInputElement).blur();
                    }
                  }}
                  disabled={cashOutBusy}
                  aria-invalid={cashOutError ? true : undefined}
                  className={cn(
                    "w-full text-base tabular-nums",
                    cashOutBusy && "pr-9",
                  )}
                  aria-label={`Cash out for ${player.name}`}
                  data-testid={`cash-out-${player.id}`}
                />
                {cashOutBusy && (
                  <Loader2
                    aria-label="Saving"
                    className="pointer-events-none absolute right-2 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground"
                  />
                )}
              </div>
            ) : (
              <span className="text-base font-medium tabular-nums">
                {player.cashOutCents === null
                  ? "—"
                  : formatCents(player.cashOutCents)}
              </span>
            )}
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

      {cashOutError?.kind === "validation" && (
        <p className="text-xs text-destructive">{cashOutError.message}</p>
      )}
      {cashOutError?.kind === "generic" && (
        <div
          role="alert"
          className="flex flex-wrap items-center gap-2 text-xs text-destructive"
        >
          <span>{cashOutError.message}</span>
          <Button
            type="button"
            size="xs"
            variant="outline"
            onClick={cashOutError.retry}
            disabled={cashOutBusy}
          >
            Retry
          </Button>
        </div>
      )}

      <div className="flex flex-col gap-2">
        {editable && (
          <Button
            type="button"
            onClick={() => setAddingBuyIn(true)}
            data-testid={`add-buy-in-cta-${player.id}`}
            className="w-full"
          >
            <Plus className="size-4" />
            Add buy-in
          </Button>
        )}

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
      </div>

      <PlayerDetailsSheet
        open={editing}
        onOpenChange={setEditing}
        sessionId={sessionId}
        status={status}
        player={player}
        initialFocus={editFocus}
      />

      <AddBuyInModal
        open={addingBuyIn}
        onOpenChange={setAddingBuyIn}
        sessionId={sessionId}
        playerId={player.id}
        playerName={player.name}
      />
    </article>
  );
}
