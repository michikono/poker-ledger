"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useState } from "react";
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
import { parseDollars } from "@/lib/currency/parse";
import { describeErrorCode } from "@/lib/errors/messages";
import { addBuyIn } from "./actions";

export type AddBuyInModalProps = {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  sessionId: string;
  playerId: string;
  playerName: string;
};

/**
 * Focused mini-dialog for the most-frequent action during play: adding a
 * buy-in for a single player. One full-width currency input + Add + Cancel.
 * Lives separately from the Player details sheet so users can fire one off
 * without opening the full editor.
 */
export function AddBuyInModal({
  open,
  onOpenChange,
  sessionId,
  playerId,
  playerName,
}: AddBuyInModalProps) {
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      setAmount("");
      setError(null);
      setSubmitting(false);
    }
  }, [open]);

  async function handleSubmit(e?: FormEvent) {
    e?.preventDefault();
    if (submitting) return;
    setError(null);

    const trimmed = amount.trim();
    if (!trimmed) {
      setError("Enter an amount.");
      return;
    }
    const cents = parseDollars(trimmed);
    if (cents === null || cents <= 0 || cents > 2_000_000) {
      setError("Enter a valid amount, e.g., 25 or 25.00.");
      return;
    }

    setSubmitting(true);
    const result = await withToken((token) =>
      addBuyIn({ sessionId, playerId, amountCents: cents }, token),
    );
    setSubmitting(false);
    if (!result) return;
    if (result.success) {
      onOpenChange(false);
      router.refresh();
      return;
    }
    setError(describeErrorCode(result.error.code));
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && submitting) return;
        onOpenChange(next);
      }}
    >
      <DialogContent
        data-testid={`add-buy-in-modal-${playerId}`}
        showCloseButton={!submitting}
      >
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Add buy-in for {playerName}</DialogTitle>
            <DialogDescription>
              Enter the amount of chips this player just bought.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 flex flex-col gap-2">
            <label
              htmlFor={`add-buy-in-input-${playerId}`}
              className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
            >
              Amount
            </label>
            <CurrencyInput
              id={`add-buy-in-input-${playerId}`}
              autoFocus
              placeholder="0.00"
              value={amount}
              onChange={setAmount}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void handleSubmit();
                }
              }}
              aria-invalid={error ? true : undefined}
              aria-label={`Buy-in amount for ${playerName}`}
              disabled={submitting}
              className="text-lg tabular-nums"
              data-testid={`add-buy-in-amount-${playerId}`}
            />
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
          </div>

          <DialogFooter className="mt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={submitting}
              data-testid={`add-buy-in-submit-${playerId}`}
            >
              {submitting && <Loader2 className="mr-1 size-4 animate-spin" />}
              Add buy-in
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
