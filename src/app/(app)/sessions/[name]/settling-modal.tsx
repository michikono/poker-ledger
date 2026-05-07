"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { VenmoIcon } from "@/components/icons/venmo-icon";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Input } from "@/components/ui/input";
import { getToken, redirectToSignIn } from "@/lib/auth/client-token";
import { formatCents } from "@/lib/currency/format";
import { parseDollars } from "@/lib/currency/parse";
import { describeErrorCode } from "@/lib/errors/messages";
import { parseVenmoHandle } from "@/lib/venmo/url";
import { setCashOut, transitionToSettling, updatePlayer } from "./actions";
import { DeltaIndicator } from "./delta-indicator";
import type { SessionPlayerView } from "./page";
import { computeSessionTotals, settleReadiness } from "./totals";

type DraftMap = Record<string, string>;

function initialDrafts(players: SessionPlayerView[]): DraftMap {
  const out: DraftMap = {};
  for (const p of players) {
    out[p.id] =
      p.cashOutCents === null ? "" : (p.cashOutCents / 100).toFixed(2);
  }
  return out;
}

function initialVenmoDrafts(players: SessionPlayerView[]): DraftMap {
  const out: DraftMap = {};
  for (const p of players) {
    out[p.id] = p.venmoUsername ?? "";
  }
  return out;
}

export function SettlingModal({
  open,
  onOpenChange,
  sessionId,
  players,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  sessionId: string;
  players: SessionPlayerView[];
}) {
  const router = useRouter();
  const [drafts, setDrafts] = useState<DraftMap>(() => initialDrafts(players));
  const [venmoDrafts, setVenmoDrafts] = useState<DraftMap>(() =>
    initialVenmoDrafts(players),
  );
  const [venmoErrors, setVenmoErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setDrafts(initialDrafts(players));
      setVenmoDrafts(initialVenmoDrafts(players));
      setVenmoErrors({});
    }
  }, [open, players]);

  const parsedPlayers = useMemo(
    () =>
      players.map((p) => {
        const draft = drafts[p.id] ?? "";
        const trimmed = draft.trim();
        const cents = trimmed === "" ? null : parseDollars(trimmed);
        const valid =
          trimmed === ""
            ? false
            : cents !== null && cents >= 0 && cents <= 2_000_000;
        return {
          id: p.id,
          name: p.name,
          buyIns: p.buyIns.map((b) => ({ amountCents: b.amountCents })),
          cashOutCents: valid ? (cents as number) : null,
          rawDraft: draft,
          valid,
        };
      }),
    [players, drafts],
  );

  const totals = computeSessionTotals(
    parsedPlayers.map((p) => ({
      buyIns: p.buyIns,
      cashOutCents: p.cashOutCents,
    })),
  );

  const allValid = parsedPlayers.every((p) => p.valid);
  const readiness = allValid
    ? settleReadiness(
        parsedPlayers.map((p) => ({
          name: p.name,
          buyIns: p.buyIns,
          cashOutCents: p.cashOutCents,
        })),
      )
    : ({
        ok: false,
        reason:
          parsedPlayers.find((p) => !p.valid)?.rawDraft.trim() === ""
            ? `${parsedPlayers.find((p) => !p.valid)?.name ?? "A player"} is missing a cash-out.`
            : "Enter a valid amount for each player.",
      } as const);

  // Validate every Venmo draft that differs from what's saved on the player.
  // Returns null if valid, or a map of {playerId: errorMessage} if any failed.
  function collectVenmoChanges():
    | { ok: true; changes: Array<{ playerId: string; handle: string | null }> }
    | { ok: false; errors: Record<string, string> } {
    const changes: Array<{ playerId: string; handle: string | null }> = [];
    const errors: Record<string, string> = {};
    for (const p of players) {
      const draft = (venmoDrafts[p.id] ?? "").trim();
      const stripped = draft.startsWith("@") ? draft.slice(1) : draft;
      const isEmpty = stripped === "";
      const next = isEmpty ? null : parseVenmoHandle(stripped);
      if (!isEmpty && next === null) {
        errors[p.id] =
          "Use 5–30 characters: letters, digits, _ . or - (no spaces).";
        continue;
      }
      if (next !== (p.venmoUsername ?? null)) {
        changes.push({ playerId: p.id, handle: next });
      }
    }
    if (Object.keys(errors).length > 0) return { ok: false, errors };
    return { ok: true, changes };
  }

  async function handleConfirm() {
    if (submitting) return;
    if (!readiness.ok) return;

    const venmoCheck = collectVenmoChanges();
    if (!venmoCheck.ok) {
      setVenmoErrors(venmoCheck.errors);
      return;
    }
    setVenmoErrors({});

    setSubmitting(true);
    const token = await getToken();
    if (!token) {
      setSubmitting(false);
      redirectToSignIn();
      return;
    }

    // Persist any drafts that differ from current cash-out values before transitioning.
    for (const p of parsedPlayers) {
      const original = players.find((x) => x.id === p.id);
      if (!original) continue;
      if (p.cashOutCents === original.cashOutCents) continue;
      const result = await setCashOut(
        { sessionId, playerId: p.id, amountCents: p.cashOutCents },
        token,
      );
      if (!result.success) {
        setSubmitting(false);
        toast.error(describeErrorCode(result.error.code));
        return;
      }
    }

    // Persist any Venmo handle changes.
    for (const change of venmoCheck.changes) {
      const original = players.find((x) => x.id === change.playerId);
      if (!original) continue;
      const result = await updatePlayer(
        {
          sessionId,
          playerId: change.playerId,
          name: original.name,
          venmoUsername: change.handle,
        },
        token,
      );
      if (!result.success) {
        setSubmitting(false);
        toast.error(describeErrorCode(result.error.code));
        return;
      }
    }

    const result = await transitionToSettling({ sessionId }, token);
    setSubmitting(false);

    if (result.success) {
      onOpenChange(false);
      router.refresh();
      return;
    }

    if (result.error.code === "UNAUTHENTICATED") {
      redirectToSignIn();
      return;
    }
    toast.error(describeErrorCode(result.error.code));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Confirm cash-outs</DialogTitle>
          <DialogDescription>
            Enter or adjust each player&apos;s cash-out, then confirm to compute
            payments.
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="p-2">Player</th>
                <th className="p-2 text-right">Total in</th>
                <th className="p-2 text-right">Cash out</th>
                <th className="p-2">
                  <span className="inline-flex items-center gap-1">
                    <VenmoIcon size={14} />
                    Venmo
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>
              {parsedPlayers.map((p) => {
                const totalIn = p.buyIns.reduce(
                  (sum, b) => sum + b.amountCents,
                  0,
                );
                const venmoErr = venmoErrors[p.id];
                return (
                  <tr key={p.id} className="border-t align-top">
                    <td className="p-2">{p.name}</td>
                    <td className="p-2 text-right tabular-nums">
                      {formatCents(totalIn)}
                    </td>
                    <td className="p-2 text-right">
                      <CurrencyInput
                        value={drafts[p.id] ?? ""}
                        onChange={(v) =>
                          setDrafts((d) => ({ ...d, [p.id]: v }))
                        }
                        aria-invalid={
                          (!p.valid && p.rawDraft !== "") || undefined
                        }
                        aria-label={`Cash out for ${p.name}`}
                        disabled={submitting}
                        className="h-8 w-24 text-right"
                        data-testid={`settling-cashout-${p.id}`}
                      />
                    </td>
                    <td className="p-2">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1">
                          <span
                            className="text-sm text-muted-foreground"
                            aria-hidden="true"
                          >
                            @
                          </span>
                          <Input
                            value={venmoDrafts[p.id] ?? ""}
                            onChange={(e) =>
                              setVenmoDrafts((d) => ({
                                ...d,
                                [p.id]: e.target.value,
                              }))
                            }
                            placeholder="optional"
                            maxLength={31}
                            aria-label={`Venmo handle for ${p.name}`}
                            aria-invalid={venmoErr ? true : undefined}
                            disabled={submitting}
                            className="h-8 w-36"
                            data-testid={`settling-venmo-${p.id}`}
                          />
                        </div>
                        {venmoErr && (
                          <span className="text-xs text-destructive">
                            {venmoErr}
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <DeltaIndicator totals={totals} />
          {!readiness.ok && (
            <p
              className="text-sm text-destructive"
              data-testid="settling-error"
            >
              {readiness.reason}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => void handleConfirm()}
            disabled={submitting || !readiness.ok}
            data-testid="settling-confirm"
          >
            {submitting ? "Settling…" : "Confirm"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
