"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCents } from "@/lib/currency/format";
import { formatCurrencyInput } from "@/lib/currency/format-input";
import { parseDollars } from "@/lib/currency/parse";
import { getClientAuth } from "@/lib/firebase/client";
import { cn } from "@/lib/utils";
import type { SessionStatus } from "@/lib/sessions/types";
import {
  addBuyIn,
  deletePlayer,
  removeBuyIn,
  setCashOut,
  updatePlayerName,
} from "./actions";
import type { SessionPlayerView } from "./page";
import { computePlayerTotals } from "./totals";

const GENERIC_ERROR = "Something went wrong — please try again.";

type BusyOp = "cashOut" | "buyIn" | "rename" | "delete" | null;

async function getToken(): Promise<string | null> {
  try {
    const auth = getClientAuth();
    await auth.authStateReady();
    return (await auth.currentUser?.getIdToken()) ?? null;
  } catch {
    return null;
  }
}

function redirectToSignIn() {
  if (typeof window !== "undefined") {
    window.location.href = `/sign-in?from=${encodeURIComponent(window.location.pathname)}`;
  }
}

export function PlayerRow({
  sessionId,
  status,
  player,
}: {
  sessionId: string;
  status: SessionStatus;
  player: SessionPlayerView;
}) {
  const router = useRouter();
  const editable = status === "in_progress";
  const renameOnly = status === "settling" || status === "settled";

  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(player.name);
  const [nameError, setNameError] = useState<string | null>(null);

  const [buyInDraft, setBuyInDraft] = useState("");
  const [buyInError, setBuyInError] = useState<string | null>(null);

  const [cashOutDraft, setCashOutDraft] = useState(
    player.cashOutCents === null ? "" : (player.cashOutCents / 100).toFixed(2),
  );
  const [cashOutError, setCashOutError] = useState<string | null>(null);

  const [busyOp, setBusyOp] = useState<BusyOp>(null);
  const [busyRemovingId, setBusyRemovingId] = useState<string | null>(null);
  const busy = busyOp !== null || busyRemovingId !== null;

  const totals = computePlayerTotals(
    player.buyIns.map((b) => ({ amountCents: b.amountCents })),
    player.cashOutCents,
  );

  async function withToken<T>(
    fn: (token: string) => Promise<T>,
  ): Promise<T | null> {
    const token = await getToken();
    if (!token) {
      redirectToSignIn();
      return null;
    }
    return await fn(token);
  }

  async function handleRename(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    const trimmed = nameDraft.trim();
    if (!trimmed) {
      setNameError("Name is required.");
      return;
    }
    if (trimmed.length > 50) {
      setNameError("Name must be 1–50 characters.");
      return;
    }
    if (trimmed === player.name) {
      setEditingName(false);
      return;
    }

    setBusyOp("rename");
    setNameError(null);
    const result = await withToken((token) =>
      updatePlayerName(
        { sessionId, playerId: player.id, name: trimmed },
        token,
      ),
    );
    setBusyOp(null);
    if (!result) return;
    if (result.success) {
      setEditingName(false);
      router.refresh();
      return;
    }
    if (result.error.code === "DUPLICATE_PLAYER_NAME") {
      setNameError("A player with that name already exists.");
      return;
    }
    if (result.error.code === "INVALID_PLAYER_NAME") {
      setNameError(result.error.message);
      return;
    }
    toast.error(GENERIC_ERROR);
  }

  async function handleDeletePlayer() {
    if (busy) return;
    setBusyOp("delete");
    const result = await withToken((token) =>
      deletePlayer({ sessionId, playerId: player.id }, token),
    );
    setBusyOp(null);
    if (!result) return;
    if (result.success) {
      router.refresh();
      return;
    }
    toast.error(GENERIC_ERROR);
  }

  async function handleAddBuyIn(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBuyInError(null);

    const trimmed = buyInDraft.trim();
    if (!trimmed) {
      setBuyInError("Enter an amount.");
      return;
    }
    const cents = parseDollars(trimmed);
    if (cents === null || cents <= 0 || cents > 2_000_000) {
      setBuyInError("Enter a valid amount, e.g., 25 or 25.00.");
      return;
    }

    setBusyOp("buyIn");
    const result = await withToken((token) =>
      addBuyIn({ sessionId, playerId: player.id, amountCents: cents }, token),
    );
    setBusyOp(null);
    if (!result) return;
    if (result.success) {
      setBuyInDraft("");
      router.refresh();
      return;
    }
    toast.error(GENERIC_ERROR);
  }

  async function handleRemoveBuyIn(buyInId: string) {
    if (busy) return;
    setBusyRemovingId(buyInId);
    const result = await withToken((token) =>
      removeBuyIn({ sessionId, playerId: player.id, buyInId }, token),
    );
    setBusyRemovingId(null);
    if (!result) return;
    if (result.success) {
      router.refresh();
      return;
    }
    toast.error(GENERIC_ERROR);
  }

  async function commitCashOut() {
    if (busy) return;
    setCashOutError(null);

    let target: number | null;
    const trimmed = cashOutDraft.trim();
    if (trimmed === "") {
      target = null;
    } else {
      const cents = parseDollars(trimmed);
      if (cents === null || cents < 0 || cents > 2_000_000) {
        setCashOutError("Enter a valid amount, e.g., 25 or 25.00.");
        return;
      }
      target = cents;
    }

    if (target === player.cashOutCents) return;

    setBusyOp("cashOut");
    const result = await withToken((token) =>
      setCashOut(
        { sessionId, playerId: player.id, amountCents: target },
        token,
      ),
    );
    setBusyOp(null);
    if (!result) return;
    if (result.success) {
      router.refresh();
      return;
    }
    toast.error(GENERIC_ERROR);
  }

  return (
    <tr className="border-t" data-testid={`player-row-${player.id}`}>
      {/* Player name */}
      <td className="p-3">
        {editingName ? (
          <div className="flex flex-col gap-1">
            <form className="flex items-center gap-1" onSubmit={handleRename}>
              <Input
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                autoFocus
                maxLength={50}
                aria-label={`Rename ${player.name}`}
                disabled={busy}
              />
              <Button type="submit" size="sm" disabled={busy}>
                {busyOp === "rename" && (
                  <Loader2 className="mr-1 size-3 animate-spin" />
                )}
                Save
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  setEditingName(false);
                  setNameDraft(player.name);
                  setNameError(null);
                }}
                disabled={busy}
              >
                Cancel
              </Button>
            </form>
            {nameError && (
              <span className="text-xs text-destructive">{nameError}</span>
            )}
            {editable && (
              <Button
                type="button"
                size="sm"
                variant="destructive"
                className="self-start"
                onClick={() => void handleDeletePlayer()}
                disabled={busy}
              >
                {busyOp === "delete" && (
                  <Loader2 className="mr-1 size-3 animate-spin" />
                )}
                Delete player
              </Button>
            )}
          </div>
        ) : (
          <button
            type="button"
            className="text-left font-medium underline-offset-4 hover:underline disabled:no-underline"
            onClick={() => {
              if (status === "archived") return;
              setEditingName(true);
            }}
            disabled={status === "archived"}
          >
            {player.name}
          </button>
        )}
      </td>

      {/* Add buy-in form — only when editable */}
      {editable && (
        <td className="p-3">
          <form className="flex items-center gap-1" onSubmit={handleAddBuyIn}>
            <Input
              type="text"
              inputMode="decimal"
              placeholder="amount"
              value={buyInDraft}
              onChange={(e) =>
                setBuyInDraft(formatCurrencyInput(e.target.value))
              }
              disabled={busy}
              aria-invalid={buyInError ? true : undefined}
              className="h-7 w-24 text-xs"
              aria-label={`Add buy-in for ${player.name}`}
            />
            <Button type="submit" size="sm" variant="outline" disabled={busy}>
              {busyOp === "buyIn" ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                "Add"
              )}
            </Button>
          </form>
          {buyInError && (
            <p className="mt-1 text-xs text-destructive">{buyInError}</p>
          )}
        </td>
      )}

      {/* Buy-in chips */}
      <td className="p-3">
        <div className="flex flex-wrap items-center gap-1">
          {player.buyIns.map((b) => (
            <span
              key={b.id}
              className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs"
              data-testid={`buy-in-${b.id}`}
            >
              {formatCents(b.amountCents)}
              {editable && (
                <button
                  type="button"
                  className="text-muted-foreground hover:text-destructive"
                  aria-label={`Remove ${formatCents(b.amountCents)} buy-in`}
                  onClick={() => void handleRemoveBuyIn(b.id)}
                  disabled={busy}
                >
                  {busyRemovingId === b.id ? (
                    <Loader2 className="size-2.5 animate-spin" />
                  ) : (
                    "×"
                  )}
                </button>
              )}
            </span>
          ))}
        </div>
      </td>

      {/* Total in */}
      <td className="p-3 text-right tabular-nums">
        {formatCents(totals.totalBuyInCents)}
      </td>

      {/* Cash out */}
      <td className="p-3 text-right">
        {editable ? (
          <div className="flex flex-col items-end gap-1">
            <div className="relative">
              <Input
                type="text"
                inputMode="decimal"
                placeholder="—"
                value={cashOutDraft}
                onChange={(e) =>
                  setCashOutDraft(formatCurrencyInput(e.target.value))
                }
                onBlur={() => void commitCashOut()}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    (e.currentTarget as HTMLInputElement).blur();
                  }
                }}
                disabled={busy}
                aria-invalid={cashOutError ? true : undefined}
                className={cn(
                  "h-8 w-24 text-right",
                  busyOp === "cashOut" && "pr-8",
                )}
                aria-label={`Cash out for ${player.name}`}
                data-testid={`cash-out-${player.id}`}
              />
              {busyOp === "cashOut" && (
                <Loader2
                  aria-label="Saving"
                  className="pointer-events-none absolute right-2 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground"
                />
              )}
            </div>
            {cashOutError && (
              <span className="text-xs text-destructive">{cashOutError}</span>
            )}
          </div>
        ) : (
          <span className="tabular-nums">
            {player.cashOutCents === null
              ? "—"
              : formatCents(player.cashOutCents)}
          </span>
        )}
      </td>

      {/* Net */}
      <td className="p-3 text-right tabular-nums">
        {totals.netCents === null
          ? "—"
          : totals.netCents === 0
            ? formatCents(0)
            : totals.netCents > 0
              ? `+${formatCents(totals.netCents)}`
              : formatCents(totals.netCents)}
      </td>
    </tr>
  );
}
