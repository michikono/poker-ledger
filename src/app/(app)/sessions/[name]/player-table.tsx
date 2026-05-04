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
import type { SessionStatus } from "@/lib/sessions/types";
import { addPlayer, updateDefaultBuyIn } from "./actions";
import { DeltaIndicator } from "./delta-indicator";
import type { SessionPlayerView } from "./page";
import { PlayerRow } from "./player-row";
import { computeSessionTotals } from "./totals";

const GENERIC_ERROR = "Something went wrong — please try again.";

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

export function PlayerTable({
  sessionId,
  status,
  defaultBuyInCents,
  players,
}: {
  sessionId: string;
  status: SessionStatus;
  defaultBuyInCents: number | null;
  players: SessionPlayerView[];
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [editingDefaultBuyIn, setEditingDefaultBuyIn] = useState(false);
  const [defaultBuyInDraft, setDefaultBuyInDraft] = useState(
    defaultBuyInCents ? (defaultBuyInCents / 100).toFixed(2) : "",
  );
  const [defaultBuyInError, setDefaultBuyInError] = useState<string | null>(
    null,
  );
  const [defaultBuyInBusy, setDefaultBuyInBusy] = useState(false);

  const editable = status === "in_progress";

  const totals = computeSessionTotals(
    players.map((p) => ({
      buyIns: p.buyIns.map((b) => ({ amountCents: b.amountCents })),
      cashOutCents: p.cashOutCents,
    })),
  );

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setError(null);

    const trimmed = name.trim();
    if (!trimmed) {
      setError("Name is required.");
      return;
    }
    if (trimmed.length > 50) {
      setError("Name must be 1–50 characters.");
      return;
    }

    setSubmitting(true);
    const token = await getToken();
    if (!token) {
      setSubmitting(false);
      redirectToSignIn();
      return;
    }

    const result = await addPlayer({ sessionId, name: trimmed }, token);
    setSubmitting(false);

    if (result.success) {
      setName("");
      router.refresh();
      return;
    }

    switch (result.error.code) {
      case "INVALID_PLAYER_NAME":
        setError(result.error.message);
        return;
      case "DUPLICATE_PLAYER_NAME":
        setError("A player with that name already exists.");
        return;
      case "UNAUTHENTICATED":
        redirectToSignIn();
        return;
      case "SESSION_NOT_EDITABLE":
        toast.error("This session can't be edited in its current state.");
        return;
      default:
        toast.error(GENERIC_ERROR);
    }
  }

  async function handleUpdateDefaultBuyIn() {
    if (defaultBuyInBusy) return;
    setDefaultBuyInError(null);

    const trimmed = defaultBuyInDraft.trim();
    let amountCents: number | null = null;

    if (trimmed !== "") {
      const cents = parseDollars(trimmed);
      if (cents === null || cents <= 0 || cents > 2_000_000) {
        setDefaultBuyInError("Enter a valid amount, e.g., 25 or 25.00.");
        return;
      }
      amountCents = cents;
    }

    if (amountCents === defaultBuyInCents) {
      setEditingDefaultBuyIn(false);
      return;
    }

    setDefaultBuyInBusy(true);
    const token = await getToken();
    if (!token) {
      setDefaultBuyInBusy(false);
      redirectToSignIn();
      return;
    }

    const result = await updateDefaultBuyIn({ sessionId, amountCents }, token);
    setDefaultBuyInBusy(false);

    if (result.success) {
      setEditingDefaultBuyIn(false);
      router.refresh();
      return;
    }
    toast.error(GENERIC_ERROR);
  }

  return (
    <section className="flex flex-col gap-3" data-testid="player-table">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Players</h2>
        {totals.totalBuyInCents > 0 || totals.totalCashOutCents > 0 ? (
          <DeltaIndicator totals={totals} />
        ) : null}
      </div>

      {players.length === 0 ? (
        <p className="rounded-md border border-dashed bg-muted/40 p-4 text-sm text-muted-foreground">
          No players yet. Add the first one.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="p-3">Player</th>
                {editable && <th className="p-3">Add buy-in</th>}
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
                />
              ))}
            </tbody>
            <tfoot className="border-t bg-muted/30">
              <tr>
                <td className="p-3 font-medium">Totals</td>
                {editable && <td className="p-3" />}
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
      )}

      {editable && (
        <form
          className="flex flex-wrap items-start gap-2"
          onSubmit={handleAdd}
          aria-label="Add player"
        >
          <div className="flex flex-col gap-1">
            <Input
              type="text"
              placeholder="Add player by name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? "add-player-error" : undefined}
              disabled={submitting}
              maxLength={50}
            />
            {error && (
              <p
                id="add-player-error"
                role="alert"
                className="text-sm text-destructive"
              >
                {error}
              </p>
            )}
            {!error && defaultBuyInCents && defaultBuyInCents > 0 && (
              <div className="flex items-center gap-1">
                {editingDefaultBuyIn ? (
                  <div className="flex items-center gap-1">
                    <Input
                      type="text"
                      inputMode="decimal"
                      placeholder="e.g. 25"
                      value={defaultBuyInDraft}
                      onChange={(e) =>
                        setDefaultBuyInDraft(
                          formatCurrencyInput(e.target.value),
                        )
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          void handleUpdateDefaultBuyIn();
                        }
                      }}
                      disabled={defaultBuyInBusy}
                      aria-invalid={defaultBuyInError ? true : undefined}
                      className="h-7 w-24 text-xs"
                      autoFocus
                    />
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => void handleUpdateDefaultBuyIn()}
                      disabled={defaultBuyInBusy}
                    >
                      {defaultBuyInBusy && (
                        <Loader2 className="mr-1 size-3 animate-spin" />
                      )}
                      Save
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setEditingDefaultBuyIn(false);
                        setDefaultBuyInDraft(
                          defaultBuyInCents
                            ? (defaultBuyInCents / 100).toFixed(2)
                            : "",
                        );
                        setDefaultBuyInError(null);
                      }}
                      disabled={defaultBuyInBusy}
                    >
                      Cancel
                    </Button>
                    {defaultBuyInError && (
                      <span className="text-xs text-destructive">
                        {defaultBuyInError}
                      </span>
                    )}
                  </div>
                ) : (
                  <>
                    <p className="text-xs text-muted-foreground">
                      New players start with a {formatCents(defaultBuyInCents)}{" "}
                      buy-in.
                    </p>
                    <button
                      type="button"
                      className="text-xs text-primary underline-offset-2 hover:underline"
                      onClick={() => setEditingDefaultBuyIn(true)}
                    >
                      Change
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Adding…" : "Add player"}
          </Button>
        </form>
      )}
    </section>
  );
}
