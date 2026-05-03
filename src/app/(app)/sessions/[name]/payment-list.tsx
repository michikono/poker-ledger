"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { formatCents } from "@/lib/currency/format";
import { getClientAuth } from "@/lib/firebase/client";
import { markPaymentPaid, unmarkPaymentPaid } from "./actions";
import type { SessionPaymentView, SessionPlayerView } from "./page";
import type { SessionStatus } from "@/lib/sessions/types";

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

export function PaymentList({
  sessionId,
  status,
  players,
  payments,
}: {
  sessionId: string;
  status: SessionStatus;
  players: SessionPlayerView[];
  payments: SessionPaymentView[];
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);

  const playerNameById = new Map(players.map((p) => [p.id, p.name]));

  async function toggle(payment: SessionPaymentView) {
    if (busyId) return;
    setBusyId(payment.id);

    const token = await getToken();
    if (!token) {
      setBusyId(null);
      redirectToSignIn();
      return;
    }

    const result = payment.paid
      ? await unmarkPaymentPaid({ sessionId, paymentId: payment.id }, token)
      : await markPaymentPaid({ sessionId, paymentId: payment.id }, token);

    setBusyId(null);

    if (result.success) {
      router.refresh();
      return;
    }
    if (result.error.code === "UNAUTHENTICATED") {
      redirectToSignIn();
      return;
    }
    toast.error(GENERIC_ERROR);
  }

  return (
    <ul className="flex flex-col gap-2" data-testid="payment-list">
      {payments.map((p) => {
        const from = playerNameById.get(p.fromPlayerId) ?? "Unknown";
        const to = playerNameById.get(p.toPlayerId) ?? "Unknown";
        const isBusy = busyId === p.id;
        return (
          <li
            key={p.id}
            className="flex items-center justify-between gap-3 rounded-md border bg-card p-3"
            data-testid={`payment-row-${p.id}`}
            data-paid={p.paid ? "true" : "false"}
          >
            <span className="flex flex-wrap items-center gap-1.5 text-sm">
              <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold">
                {from}
              </span>
              <span className="text-muted-foreground">pays</span>
              <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold">
                {to}
              </span>
              <strong className="text-base tabular-nums">
                {formatCents(p.amountCents)}
              </strong>
            </span>
            <div className="flex items-center gap-2">
              {p.paid && (
                <span
                  className="text-xs text-emerald-700 dark:text-emerald-400"
                  aria-label="paid"
                >
                  Paid
                </span>
              )}
              {status === "settled" || p.paid ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => void toggle(p)}
                  disabled={isBusy}
                >
                  {isBusy ? "Working…" : "Unmark"}
                </Button>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  onClick={() => void toggle(p)}
                  disabled={isBusy}
                >
                  {isBusy ? "Working…" : "Mark paid"}
                </Button>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
