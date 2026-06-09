"use client";

import { Check, Loader2 } from "lucide-react";
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
import { parseDollars } from "@/lib/currency/parse";
import { describeErrorCode } from "@/lib/errors/messages";
import { updateDefaultBuyIn } from "./actions";

export type DefaultBuyInModalProps = {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  sessionId: string;
  defaultBuyInCents: number | null;
};

/**
 * Focused dialog for editing the per-session default buy-in. Replaces the
 * previous inline editor + tiny "Change" link in the player-list footer.
 */
export function DefaultBuyInModal({
  open,
  onOpenChange,
  sessionId,
  defaultBuyInCents,
}: DefaultBuyInModalProps) {
  const router = useRouter();
  const [amount, setAmount] = useState(
    defaultBuyInCents ? (defaultBuyInCents / 100).toFixed(2) : "",
  );
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setAmount(defaultBuyInCents ? (defaultBuyInCents / 100).toFixed(2) : "");
    setError(null);
    setSubmitting(false);
  }, [open, defaultBuyInCents]);

  async function handleSubmit(e?: FormEvent) {
    e?.preventDefault();
    if (submitting) return;
    setError(null);

    const trimmed = amount.trim();
    let amountCents: number | null = null;
    if (trimmed !== "") {
      const cents = parseDollars(trimmed);
      if (cents === null || cents <= 0 || cents > 2_000_000) {
        setError("Enter a valid amount, e.g., 25 or 25.00.");
        return;
      }
      amountCents = cents;
    }

    if (amountCents === defaultBuyInCents) {
      onOpenChange(false);
      return;
    }

    setSubmitting(true);
    const result = await withToken((token) =>
      updateDefaultBuyIn({ sessionId, amountCents }, token),
    );
    setSubmitting(false);
    if (!result) return;
    if (result.success) {
      toast.success(
        amountCents === null
          ? "Default buy-in cleared"
          : "Default buy-in updated",
      );
      onOpenChange(false);
      router.refresh();
      return;
    }
    toast.error(describeErrorCode(result.error.code));
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
        data-testid="default-buy-in-modal"
        showCloseButton={!submitting}
      >
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Default buy-in</DialogTitle>
            <DialogDescription>
              New players added to this session will start with this buy-in.
              Leave blank to disable.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 flex flex-col gap-2">
            <label
              htmlFor="default-buy-in-input"
              className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
            >
              Amount
            </label>
            <CurrencyInput
              id="default-buy-in-input"
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
              aria-label="Default buy-in"
              disabled={submitting}
              className="text-lg tabular-nums"
              data-testid="default-buy-in-amount"
            />
            {error && (
              <p role="alert" className="text-sm text-destructive-fg">
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
              data-testid="default-buy-in-submit"
            >
              {submitting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Check className="size-4" />
              )}
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
