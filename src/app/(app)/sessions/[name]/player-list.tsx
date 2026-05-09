"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Input } from "@/components/ui/input";
import { getToken, redirectToSignIn } from "@/lib/auth/client-token";
import { formatCents } from "@/lib/currency/format";
import { parseDollars } from "@/lib/currency/parse";
import { describeErrorCode } from "@/lib/errors/messages";
import {
  describePlayerNameError,
  validatePlayerName,
} from "@/lib/players/name";
import type { SessionStatus } from "@/lib/sessions/types";
import { addPlayer, updateDefaultBuyIn } from "./actions";
import { DeltaIndicator } from "./delta-indicator";
import type { SessionPlayerView } from "./page";
import { PlayerCard } from "./player-card";
import type { PlayerRowHandle } from "./player-row";
import { PlayerTable } from "./player-table";
import { computeSessionTotals } from "./totals";

export function PlayerList({
  sessionId,
  status,
  defaultBuyInCents,
  players,
  playerRowsRef,
}: {
  sessionId: string;
  status: SessionStatus;
  defaultBuyInCents: number | null;
  players: SessionPlayerView[];
  playerRowsRef?: { current: Map<string, PlayerRowHandle> };
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
    toast.error(describeErrorCode(result.error.code));
  }

  return (
    <section className="flex flex-col gap-3" data-testid="player-table">
      <div className="flex items-center justify-between gap-2">
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
              totals={totals}
              {...(playerRowsRef ? { playerRowsRef } : {})}
            />
          </div>
        </>
      )}

      {editable && (
        <form
          className="flex flex-col gap-2 md:flex-row md:flex-wrap md:items-start"
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
                className="text-sm text-destructive"
              >
                {error}
              </p>
            )}
            {!error && defaultBuyInCents && defaultBuyInCents > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                {editingDefaultBuyIn ? (
                  <div className="flex w-full flex-wrap items-center gap-2">
                    <CurrencyInput
                      placeholder="0.00"
                      value={defaultBuyInDraft}
                      onChange={setDefaultBuyInDraft}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          void handleUpdateDefaultBuyIn();
                        }
                      }}
                      disabled={defaultBuyInBusy}
                      aria-invalid={defaultBuyInError ? true : undefined}
                      className="w-28 md:w-24"
                      autoFocus
                    />
                    <Button
                      type="button"
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
                      <span className="w-full text-xs text-destructive">
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
