"use client";

import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { VenmoIcon } from "@/components/icons/venmo-icon";
import { Button } from "@/components/ui/button";
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

  function handleVenmoDraftChange(playerId: string, value: string) {
    setVenmoDrafts((d) => ({ ...d, [playerId]: value }));
  }

  function handleCashOutDraftChange(playerId: string, value: string) {
    setDrafts((d) => ({ ...d, [playerId]: value }));
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/40 transition-opacity duration-150 supports-backdrop-filter:backdrop-blur-xs data-ending-style:opacity-0 data-starting-style:opacity-0" />
        <DialogPrimitive.Popup
          data-slot="settling-modal"
          className="fixed inset-0 z-50 flex flex-col bg-popover text-popover-foreground shadow-xl outline-none transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0 md:inset-y-4 md:left-1/2 md:h-auto md:max-h-[calc(100svh-2rem)] md:w-[calc(100%-2rem)] md:max-w-2xl md:-translate-x-1/2 md:rounded-xl md:ring-1 md:ring-foreground/10"
        >
          <header className="flex flex-col gap-1 border-b border-border px-4 py-3">
            <DialogPrimitive.Title className="font-heading text-base font-medium">
              Confirm cash-outs
            </DialogPrimitive.Title>
            <DialogPrimitive.Description className="text-sm text-muted-foreground">
              Enter or adjust each player&apos;s cash-out, then confirm to
              compute payments.
            </DialogPrimitive.Description>
          </header>

          <div
            className="flex-1 overflow-y-auto px-4 py-3 pb-[calc(env(safe-area-inset-bottom)+8rem)] md:pb-3"
            data-slot="settling-modal-body"
          >
            {/* Mobile: stacked cards. */}
            <div className="flex flex-col gap-3 md:hidden">
              {parsedPlayers.map((p) => {
                const totalIn = p.buyIns.reduce(
                  (sum, b) => sum + b.amountCents,
                  0,
                );
                const venmoErr = venmoErrors[p.id];
                return (
                  <article
                    key={p.id}
                    data-slot="settling-card"
                    data-testid={`settling-card-${p.id}`}
                    className="flex flex-col gap-3 rounded-lg border bg-card p-3"
                  >
                    <header className="flex items-center justify-between gap-2">
                      <h3 className="text-base font-medium">{p.name}</h3>
                      <span className="text-sm text-muted-foreground tabular-nums">
                        Total in {formatCents(totalIn)}
                      </span>
                    </header>
                    <div className="flex flex-col gap-1">
                      <label
                        htmlFor={`settling-cashout-mobile-${p.id}`}
                        className="text-xs font-medium text-muted-foreground"
                      >
                        Cash out
                      </label>
                      <CurrencyInput
                        id={`settling-cashout-mobile-${p.id}`}
                        value={drafts[p.id] ?? ""}
                        onChange={(v) => handleCashOutDraftChange(p.id, v)}
                        aria-invalid={
                          (!p.valid && p.rawDraft !== "") || undefined
                        }
                        aria-label={`Cash out for ${p.name}`}
                        disabled={submitting}
                        className="tabular-nums"
                        data-testid={`settling-cashout-${p.id}`}
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label
                        htmlFor={`settling-venmo-mobile-${p.id}`}
                        className="flex items-center gap-1 text-xs font-medium text-muted-foreground"
                      >
                        <VenmoIcon size={14} title="Venmo" />
                        Venmo handle (optional)
                      </label>
                      <div className="flex items-center gap-1">
                        <span
                          className="text-base text-muted-foreground"
                          aria-hidden="true"
                        >
                          @
                        </span>
                        <Input
                          id={`settling-venmo-mobile-${p.id}`}
                          value={venmoDrafts[p.id] ?? ""}
                          onChange={(e) =>
                            handleVenmoDraftChange(p.id, e.target.value)
                          }
                          placeholder="optional"
                          maxLength={31}
                          aria-label={`Venmo handle for ${p.name}`}
                          aria-invalid={venmoErr ? true : undefined}
                          disabled={submitting}
                          data-testid={`settling-venmo-${p.id}`}
                        />
                      </div>
                      {venmoErr && (
                        <span className="text-xs text-destructive">
                          {venmoErr}
                        </span>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>

            {/* md+: table. */}
            <div className="hidden overflow-x-auto rounded-md border md:block">
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
                            onChange={(v) => handleCashOutDraftChange(p.id, v)}
                            aria-invalid={
                              (!p.valid && p.rawDraft !== "") || undefined
                            }
                            aria-label={`Cash out for ${p.name}`}
                            disabled={submitting}
                            className="w-24 text-right"
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
                                  handleVenmoDraftChange(p.id, e.target.value)
                                }
                                placeholder="optional"
                                maxLength={31}
                                aria-label={`Venmo handle for ${p.name}`}
                                aria-invalid={venmoErr ? true : undefined}
                                disabled={submitting}
                                className="w-36"
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

            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
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
          </div>

          <div
            data-slot="settling-modal-footer"
            className="absolute inset-x-0 bottom-0 flex flex-col-reverse gap-2 border-t border-border bg-background/85 p-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] supports-backdrop-filter:bg-background/70 supports-backdrop-filter:backdrop-blur-sm sm:flex-row sm:justify-end md:relative md:inset-x-auto md:bottom-auto md:rounded-b-xl md:bg-muted/50 md:pb-3"
          >
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void handleConfirm()}
              disabled={submitting || !readiness.ok}
              data-testid="settling-confirm"
              className="w-full sm:w-auto"
            >
              {submitting ? "Settling…" : "Confirm"}
            </Button>
          </div>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
