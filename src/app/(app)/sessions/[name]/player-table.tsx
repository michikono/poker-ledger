"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCents } from "@/lib/currency/format";
import { getClientAuth } from "@/lib/firebase/client";
import type { SessionStatus } from "@/lib/sessions/types";
import { addPlayer } from "./actions";
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

  const editable = status === "in_progress";
  const renameOnly = status === "settling" || status === "settled";

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
                <th className="p-3">Buy-ins</th>
                <th className="p-3 text-right">Total in</th>
                <th className="p-3 text-right">Cash out</th>
                <th className="p-3 text-right">Net</th>
                {(editable || renameOnly) && <th className="p-3" />}
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
            <tfoot className="border-t bg-muted/30 text-xs">
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
                {(editable || renameOnly) && <td className="p-3" />}
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
              <p className="text-xs text-muted-foreground">
                New players start with a {formatCents(defaultBuyInCents)}{" "}
                buy-in.
              </p>
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
