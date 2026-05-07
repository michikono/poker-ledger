"use client";

import { useRouter } from "next/navigation";
import { type ReactElement, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getToken, redirectToSignIn } from "@/lib/auth/client-token";
import { parseDollars } from "@/lib/currency/parse";
import { describeErrorCode } from "@/lib/errors/messages";
import { createSession } from "./actions";

const AMOUNT_ERROR = "Enter a valid amount, e.g., 25 or 25.00.";
const NAME_COLLISION_TOAST = "Couldn't create a session — please try again.";

export function CreateSessionDialog({
  trigger,
}: { trigger?: ReactElement } = {}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function handleOpenChange(next: boolean) {
    if (submitting) return;
    setOpen(next);
    if (next) {
      setAmount("");
      setInlineError(null);
    }
  }

  async function handleCreate() {
    if (submitting) return;
    setInlineError(null);

    let defaultBuyInCents: number | undefined;
    const trimmed = amount.trim();
    if (trimmed.length > 0) {
      const parsed = parseDollars(trimmed);
      if (parsed === null || parsed <= 0 || parsed > 2_000_000) {
        setInlineError(AMOUNT_ERROR);
        return;
      }
      defaultBuyInCents = parsed;
    }

    setSubmitting(true);
    const token = await getToken();
    if (!token) {
      setSubmitting(false);
      redirectToSignIn();
      return;
    }

    const result = await createSession(
      defaultBuyInCents === undefined ? {} : { defaultBuyInCents },
      token,
    );
    setSubmitting(false);

    if (result.success) {
      setOpen(false);
      router.push(`/sessions/${result.data.sessionId}`);
      return;
    }

    switch (result.error.code) {
      case "INVALID_AMOUNT":
        setInlineError(AMOUNT_ERROR);
        return;
      case "NAME_COLLISION":
        toast.error(NAME_COLLISION_TOAST);
        return;
      case "UNAUTHENTICATED":
        redirectToSignIn();
        return;
      default:
        toast.error(describeErrorCode(result.error.code));
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={trigger ?? <Button>New session</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New session</DialogTitle>
          <DialogDescription>
            Pick a default buy-in for new players, or leave blank.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          <Label htmlFor="create-session-default-buy-in">
            Default buy-in (optional)
          </Label>
          <Input
            id="create-session-default-buy-in"
            type="text"
            inputMode="decimal"
            autoComplete="off"
            placeholder="e.g., 25 or 25.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void handleCreate();
              }
            }}
            aria-invalid={inlineError ? true : undefined}
            aria-describedby={
              inlineError ? "create-session-default-buy-in-error" : undefined
            }
            disabled={submitting}
          />
          {inlineError && (
            <p
              id="create-session-default-buy-in-error"
              role="alert"
              className="text-sm text-destructive"
            >
              {inlineError}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={submitting}
            onClick={() => handleOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={submitting}
            onClick={() => void handleCreate()}
          >
            {submitting ? "Creating…" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
