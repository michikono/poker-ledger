"use client";

import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { CurrencyInput } from "@/components/ui/currency-input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { withToken } from "@/lib/auth/client-token";
import { formatCents } from "@/lib/currency/format";
import { parseDollars } from "@/lib/currency/parse";
import { describeErrorCode } from "@/lib/errors/messages";
import { addBuyIn, removeBuyIn } from "./actions";
import type { SessionPlayerView } from "./page";

type RowError = { kind: "validation" | "generic"; message: string } | null;

export type BuyInsModalProps = {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  sessionId: string;
  player: SessionPlayerView;
  /** Session default buy-in; prefills the amount when set (> 0). */
  defaultBuyInCents: number | null;
  /** Flash the player's row/card after an add or remove. */
  onPlayerChanged?: (playerId: string) => void;
};

/**
 * Dedicated buy-in manager: add (prefilled to the session default) plus a list
 * of existing buy-ins with per-row remove. Lives apart from the player Edit
 * sheet so the most frequent action — recording a buy-in — is one tap from the
 * roster. Only mounted while buy-ins are editable (in_progress).
 */
export function BuyInsModal({
  open,
  onOpenChange,
  sessionId,
  player,
  defaultBuyInCents,
  onPlayerChanged,
}: BuyInsModalProps) {
  const router = useRouter();

  // The default buy-in formatted as a dollars string, used to prefill the
  // amount so a standard buy-in is a single tap.
  const prefill =
    defaultBuyInCents && defaultBuyInCents > 0
      ? (defaultBuyInCents / 100).toFixed(2)
      : "";

  const [amount, setAmount] = useState(prefill);
  const [addError, setAddError] = useState<RowError>(null);
  const [adding, setAdding] = useState(false);

  const [removingId, setRemovingId] = useState<string | null>(null);
  const [removeError, setRemoveError] = useState<{
    buyInId: string;
    message: string;
  } | null>(null);

  const [confirmingDiscard, setConfirmingDiscard] = useState(false);

  const busy = adding || removingId !== null;

  const totalBuyInCents = player.buyIns.reduce(
    (sum, b) => sum + b.amountCents,
    0,
  );

  // Reset on open (NOT on `player`): the buy-in list comes from the `player`
  // prop and refreshes via router.refresh() after each action — keying this on
  // `player` would wipe a typed amount the moment a remove refreshes. `prefill`
  // is value-stable while the modal is open (the default can't change without
  // closing this modal first), so it doesn't cause extra resets.
  useEffect(() => {
    if (!open) return;
    setAmount(prefill);
    setAddError(null);
    setRemoveError(null);
    setAdding(false);
    setRemovingId(null);
    setConfirmingDiscard(false);
  }, [open, prefill]);

  // A "pending" amount worth guarding exists only when the user changed the
  // amount away from the untouched prefill — so accepting/ignoring the prefill
  // never triggers a discard prompt.
  const pending = amount.trim() !== "" && amount.trim() !== prefill.trim();

  function attemptClose() {
    if (busy) return;
    if (pending) {
      setConfirmingDiscard(true);
      return;
    }
    onOpenChange(false);
  }

  async function handleAdd(e?: FormEvent) {
    e?.preventDefault();
    if (busy) return;
    setAddError(null);

    const trimmed = amount.trim();
    if (!trimmed) {
      setAddError({ kind: "validation", message: "Enter an amount." });
      return;
    }
    const cents = parseDollars(trimmed);
    if (cents === null || cents <= 0 || cents > 2_000_000) {
      setAddError({
        kind: "validation",
        message: "Enter a valid amount, e.g., 25 or 25.00.",
      });
      return;
    }

    setAdding(true);
    try {
      const result = await withToken((token) =>
        addBuyIn({ sessionId, playerId: player.id, amountCents: cents }, token),
      );
      if (!result) return;
      if (result.success) {
        toast.success(`Added ${formatCents(cents)} buy-in for ${player.name}`);
        onPlayerChanged?.(player.id);
        router.refresh();
        // Reset to the prefill (not empty) so consecutive rebuys are one tap,
        // and so closing right after doesn't trip the discard guard.
        setAmount(prefill);
        return;
      }
      setAddError({
        kind: "generic",
        message: describeErrorCode(result.error.code),
      });
    } catch {
      setAddError({
        kind: "generic",
        message:
          "Couldn't add the buy-in. Check your connection and try again.",
      });
    } finally {
      setAdding(false);
    }
  }

  async function handleRemove(buyInId: string) {
    if (busy) return;
    setRemoveError(null);
    setRemovingId(buyInId);
    try {
      const result = await withToken((token) =>
        removeBuyIn({ sessionId, playerId: player.id, buyInId }, token),
      );
      if (!result) return;
      if (result.success) {
        toast.success(`Removed buy-in from ${player.name}`);
        onPlayerChanged?.(player.id);
        router.refresh();
        return;
      }
      setRemoveError({
        buyInId,
        message: describeErrorCode(result.error.code),
      });
    } catch {
      setRemoveError({
        buyInId,
        message:
          "Couldn't remove the buy-in. Check your connection and try again.",
      });
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <>
      <DialogPrimitive.Root
        open={open}
        onOpenChange={(next) => {
          // Route every base-ui close (backdrop, Escape) through the same
          // unsaved-amount guard the Close button uses.
          if (!next) {
            attemptClose();
            return;
          }
          onOpenChange(next);
        }}
      >
        <DialogPrimitive.Portal>
          <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/40 transition-opacity duration-150 supports-backdrop-filter:backdrop-blur-xs data-ending-style:opacity-0 data-starting-style:opacity-0" />
          <DialogPrimitive.Popup
            data-slot="buy-ins-modal"
            data-testid={`buy-ins-modal-${player.id}`}
            className="fixed inset-0 z-50 flex flex-col bg-popover text-popover-foreground shadow-xl outline-none transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0 md:inset-y-4 md:left-1/2 md:h-auto md:max-h-[calc(100svh-2rem)] md:w-[calc(100%-2rem)] md:max-w-md md:-translate-x-1/2 md:rounded-xl md:ring-1 md:ring-foreground/10"
          >
            <header className="flex flex-col gap-1 border-b border-border px-2 py-2">
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                <div className="justify-self-start">
                  <Button
                    type="button"
                    variant="ghost"
                    aria-label="Close"
                    disabled={busy}
                    onClick={attemptClose}
                    data-testid={`pbi-close-${player.id}`}
                  >
                    Close
                  </Button>
                </div>
                {/* Title is WHO the modal is for; the description states the
                    action the user is about to take. */}
                <DialogPrimitive.Title className="truncate text-center font-heading text-base font-medium">
                  {player.name}
                </DialogPrimitive.Title>
                <div className="justify-self-end" />
              </div>
              <DialogPrimitive.Description className="px-2 pb-1 text-center text-sm text-muted-foreground">
                {player.buyIns.length > 0
                  ? "Add a buy-in, or remove one below."
                  : "Add a buy-in to get started."}
              </DialogPrimitive.Description>
            </header>

            <div className="flex-1 overflow-y-auto px-4 py-3 pb-[calc(env(safe-area-inset-bottom)+1rem)] md:pb-3">
              <div className="flex flex-col gap-4">
                {/* Add a buy-in */}
                <form
                  onSubmit={handleAdd}
                  className="flex flex-col gap-1"
                  aria-label={`Add buy-in for ${player.name}`}
                  data-testid={`pbi-add-form-${player.id}`}
                >
                  <label
                    htmlFor={`pbi-amount-${player.id}`}
                    className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
                  >
                    Add a buy-in
                  </label>
                  <CurrencyInput
                    id={`pbi-amount-${player.id}`}
                    data-testid={`pbi-amount-${player.id}`}
                    placeholder="0.00"
                    value={amount}
                    onChange={setAmount}
                    disabled={busy}
                    aria-invalid={addError ? true : undefined}
                    className="tabular-nums"
                  />
                  <Button
                    type="submit"
                    size="touch"
                    variant={amount.trim() ? "default" : "outline"}
                    disabled={busy || !amount.trim()}
                    data-testid={`pbi-add-${player.id}`}
                    className="w-full"
                  >
                    {adding ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Plus className="size-4" />
                    )}
                    Add buy-in
                  </Button>
                  {addError && (
                    <p className="text-xs text-destructive-fg">
                      {addError.message}
                    </p>
                  )}
                </form>

                {/* Existing buy-ins */}
                <section className="flex flex-col gap-2">
                  <header className="flex items-baseline justify-between gap-2">
                    <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Buy-ins
                    </h3>
                    <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground tabular-nums">
                      Total {formatCents(totalBuyInCents)}
                    </span>
                  </header>

                  {player.buyIns.length === 0 ? (
                    <p className="rounded-md border border-dashed bg-muted/40 px-3 py-3 text-sm text-muted-foreground">
                      No buy-ins yet.
                    </p>
                  ) : (
                    <ul className="flex flex-col divide-y divide-border rounded-md border bg-card">
                      {player.buyIns.map((b) => (
                        <li
                          key={b.id}
                          className="flex items-center justify-between gap-3 px-3 py-2"
                          data-testid={`pbi-row-${b.id}`}
                        >
                          <span className="text-base font-medium tabular-nums">
                            {formatCents(b.amountCents)}
                          </span>
                          <Button
                            type="button"
                            variant="outline"
                            size="touch"
                            onClick={() => void handleRemove(b.id)}
                            disabled={busy}
                            aria-label={`Remove ${formatCents(b.amountCents)} buy-in`}
                            data-testid={`pbi-remove-${b.id}`}
                          >
                            {removingId === b.id ? (
                              <Loader2 className="size-4 animate-spin" />
                            ) : (
                              <Trash2 className="size-4" />
                            )}
                            Remove
                          </Button>
                        </li>
                      ))}
                    </ul>
                  )}

                  {removeError && (
                    <p role="alert" className="text-xs text-destructive-fg">
                      {removeError.message}
                    </p>
                  )}
                </section>
              </div>
            </div>
          </DialogPrimitive.Popup>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>

      <Dialog open={confirmingDiscard} onOpenChange={setConfirmingDiscard}>
        <DialogContent
          showCloseButton={false}
          data-testid={`pbi-discard-confirm-${player.id}`}
        >
          <DialogHeader>
            <DialogTitle>Discard amount?</DialogTitle>
            <DialogDescription>
              You entered a buy-in amount but haven't added it. Leave without
              adding?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setConfirmingDiscard(false)}
              data-testid={`pbi-discard-keep-${player.id}`}
            >
              Keep editing
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                setConfirmingDiscard(false);
                onOpenChange(false);
              }}
              data-testid={`pbi-discard-confirm-yes-${player.id}`}
            >
              Discard
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
