"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { formatCents } from "@/lib/currency/format";
import { parseDollars } from "@/lib/currency/parse";
import { getClientAuth } from "@/lib/firebase/client";
import { formatCurrencyInput } from "@/lib/currency/format-input";
import { setCashOut, transitionToSettling } from "./actions";
import { DeltaIndicator } from "./delta-indicator";
import type { SessionPlayerView } from "./page";
import { computeSessionTotals, settleReadiness } from "./totals";

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

type DraftMap = Record<string, string>;

function initialDrafts(players: SessionPlayerView[]): DraftMap {
  const out: DraftMap = {};
  for (const p of players) {
    out[p.id] =
      p.cashOutCents === null ? "" : (p.cashOutCents / 100).toFixed(2);
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
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) setDrafts(initialDrafts(players));
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

  async function handleConfirm() {
    if (submitting) return;
    if (!readiness.ok) return;

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
        toast.error(GENERIC_ERROR);
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
    if (result.error.code === "BALANCE_OUT_OF_RANGE") {
      toast.error("Cash-outs and buy-ins are out of balance.");
      return;
    }
    toast.error(GENERIC_ERROR);
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
              </tr>
            </thead>
            <tbody>
              {parsedPlayers.map((p) => {
                const totalIn = p.buyIns.reduce(
                  (sum, b) => sum + b.amountCents,
                  0,
                );
                return (
                  <tr key={p.id} className="border-t">
                    <td className="p-2">{p.name}</td>
                    <td className="p-2 text-right tabular-nums">
                      {formatCents(totalIn)}
                    </td>
                    <td className="p-2 text-right">
                      <Input
                        type="text"
                        inputMode="decimal"
                        value={drafts[p.id] ?? ""}
                        onChange={(e) =>
                          setDrafts((d) => ({
                            ...d,
                            [p.id]: formatCurrencyInput(e.target.value),
                          }))
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
