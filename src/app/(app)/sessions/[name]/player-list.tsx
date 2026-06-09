"use client";

import { UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getToken, redirectToSignIn } from "@/lib/auth/client-token";
import { describeErrorCode } from "@/lib/errors/messages";
import {
  describePlayerNameError,
  validatePlayerName,
} from "@/lib/players/name";
import type { SessionStatus } from "@/lib/sessions/types";
import { addPlayer } from "./actions";
import { DeltaIndicator } from "./delta-indicator";
import type { SessionPlayerView } from "./page";
import { PlayerCard } from "./player-card";
import type { PlayerRowHandle } from "./player-row";
import { PlayerTable } from "./player-table";
import { computeSessionTotals } from "./totals";

export function PlayerList({
  sessionId,
  status,
  players,
  defaultBuyInCents,
  playerRowsRef,
}: {
  sessionId: string;
  status: SessionStatus;
  players: SessionPlayerView[];
  defaultBuyInCents: number | null;
  playerRowsRef?: { current: Map<string, PlayerRowHandle> };
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Highlights a row briefly so the user can tell which player just changed
  // (additions, renames, and inline edits all reorder the list since players
  // are sorted alphabetically). The flash auto-clears after the CSS animation
  // length so a stale highlightedId doesn't survive across multiple actions.
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const highlightTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function highlight(id: string) {
    if (highlightTimer.current) clearTimeout(highlightTimer.current);
    setHighlightedId(id);
    highlightTimer.current = setTimeout(() => setHighlightedId(null), 2000);
  }
  useEffect(() => {
    return () => {
      if (highlightTimer.current) clearTimeout(highlightTimer.current);
    };
  }, []);

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

    const validated = validatePlayerName(name);
    if (!validated.ok) {
      setError(describePlayerNameError(validated.error));
      return;
    }
    const trimmed = validated.trimmed;

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
      toast.success(`Added ${trimmed}`);
      highlight(result.data.playerId);
      router.refresh();
      return;
    }

    switch (result.error.code) {
      case "INVALID_PLAYER_NAME":
        setError(result.error.message);
        return;
      case "DUPLICATE_PLAYER_NAME":
        setError(describeErrorCode(result.error.code));
        return;
      case "UNAUTHENTICATED":
        redirectToSignIn();
        return;
      default:
        toast.error(describeErrorCode(result.error.code));
    }
  }

  return (
    <section className="flex flex-col gap-3" data-testid="player-table">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Players</h2>
        {totals.totalBuyInCents > 0 || totals.totalCashOutCents > 0 ? (
          <DeltaIndicator totals={totals} />
        ) : null}
      </div>

      {/* Add player at the top of the players section. */}
      {editable && (
        <form
          className="flex flex-col gap-2 md:flex-row md:items-start"
          onSubmit={handleAdd}
          aria-label="Add player"
        >
          <div className="flex flex-1 flex-col gap-1">
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
                className="text-sm text-destructive-fg"
              >
                {error}
              </p>
            )}
          </div>
          <Button
            type="submit"
            variant="outline"
            disabled={submitting}
            data-testid="add-player-submit"
          >
            <UserPlus className="size-4" />
            {submitting ? "Adding…" : "Add player"}
          </Button>
        </form>
      )}

      {players.length === 0 ? (
        <p className="rounded-md border border-dashed bg-muted/40 p-4 text-sm text-muted-foreground">
          No players yet. Add the first one.
        </p>
      ) : (
        <>
          {/* Mobile: stacked card list. */}
          <div
            className="flex flex-col gap-3 md:hidden"
            data-testid="player-card-list"
          >
            {players.map((p) => (
              <PlayerCard
                key={p.id}
                sessionId={sessionId}
                status={status}
                player={p}
                defaultBuyInCents={defaultBuyInCents}
                highlighted={highlightedId === p.id}
                onPlayerChanged={highlight}
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
          </div>

          {/* md+: real table. */}
          <div className="hidden md:block">
            <PlayerTable
              sessionId={sessionId}
              status={status}
              players={players}
              defaultBuyInCents={defaultBuyInCents}
              totals={totals}
              highlightedId={highlightedId}
              onPlayerChanged={highlight}
              {...(playerRowsRef ? { playerRowsRef } : {})}
            />
          </div>
        </>
      )}
    </section>
  );
}
