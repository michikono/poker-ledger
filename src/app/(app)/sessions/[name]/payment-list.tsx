"use client";

import { QRCodeSVG } from "qrcode.react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatCents } from "@/lib/currency/format";
import { getClientAuth } from "@/lib/firebase/client";
import { buildVenmoPayUrl, formatVenmoNote } from "@/lib/venmo/url";
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

type QrModalState = {
  payeeName: string;
  payeeHandle: string;
  amountCents: number;
  url: string;
};

export function PaymentList({
  sessionId,
  status,
  sessionName,
  sessionCreatedAtIso,
  players,
  payments,
}: {
  sessionId: string;
  status: SessionStatus;
  sessionName: string;
  sessionCreatedAtIso: string;
  players: SessionPlayerView[];
  payments: SessionPaymentView[];
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [qrModal, setQrModal] = useState<QrModalState | null>(null);

  const playerById = new Map(players.map((p) => [p.id, p]));
  const note = formatVenmoNote({
    name: sessionName,
    createdAt: new Date(sessionCreatedAtIso),
  });

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

  function focusEditPlayer(playerId: string) {
    if (typeof document === "undefined") return;
    const row = document.querySelector(
      `[data-testid="player-row-${playerId}"]`,
    );
    if (!row) return;
    row.scrollIntoView({ behavior: "smooth", block: "center" });
    const button = row.querySelector("button");
    if (button instanceof HTMLButtonElement) button.click();
  }

  return (
    <>
      <ul className="flex flex-col gap-2" data-testid="payment-list">
        {payments.map((p) => {
          const fromPlayer = playerById.get(p.fromPlayerId);
          const toPlayer = playerById.get(p.toPlayerId);
          const fromName = fromPlayer?.name ?? "Unknown";
          const toName = toPlayer?.name ?? "Unknown";
          const isBusy = busyId === p.id;

          const payeeHandle = toPlayer?.venmoUsername ?? null;
          const venmoUrl = payeeHandle
            ? buildVenmoPayUrl({
                handle: payeeHandle,
                amountCents: p.amountCents,
                note,
              })
            : null;

          return (
            <li
              key={p.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-card p-3"
              data-testid={`payment-row-${p.id}`}
              data-paid={p.paid ? "true" : "false"}
            >
              <span className="flex flex-wrap items-center gap-1.5 text-sm">
                <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold">
                  {fromName}
                </span>
                <span className="text-muted-foreground">pays</span>
                <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold">
                  {toName}
                </span>
                <strong className="text-base tabular-nums">
                  {formatCents(p.amountCents)}
                </strong>
              </span>
              <div className="flex flex-wrap items-center gap-2">
                {p.paid && (
                  <span
                    className="text-xs text-emerald-700 dark:text-emerald-400"
                    aria-label="paid"
                  >
                    Paid
                  </span>
                )}
                {!p.paid && venmoUrl && (
                  <>
                    <a
                      href={venmoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      data-testid={`venmo-pay-${p.id}`}
                      aria-label={`Pay ${toName} ${formatCents(p.amountCents)} on Venmo`}
                      className={buttonVariants({ size: "sm" })}
                    >
                      Pay
                    </a>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        if (!payeeHandle) return;
                        setQrModal({
                          payeeName: toName,
                          payeeHandle,
                          amountCents: p.amountCents,
                          url: venmoUrl,
                        });
                      }}
                      data-testid={`venmo-qr-${p.id}`}
                    >
                      QR
                    </Button>
                  </>
                )}
                {!p.paid && !venmoUrl && toPlayer && (
                  <button
                    type="button"
                    onClick={() => focusEditPlayer(toPlayer.id)}
                    className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                    data-testid={`add-venmo-cta-${p.id}`}
                  >
                    Add Venmo for {toName}
                  </button>
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

      <Dialog
        open={qrModal !== null}
        onOpenChange={(open) => {
          if (!open) setQrModal(null);
        }}
      >
        <DialogContent data-testid="venmo-qr-dialog" className="sm:max-w-xs">
          <DialogHeader>
            <DialogTitle>Scan to pay on Venmo</DialogTitle>
            {qrModal && (
              <DialogDescription>
                Pay {qrModal.payeeName} (@{qrModal.payeeHandle}){" "}
                <strong className="tabular-nums">
                  {formatCents(qrModal.amountCents)}
                </strong>
                .
              </DialogDescription>
            )}
          </DialogHeader>
          {qrModal && (
            <div className="flex flex-col items-center gap-3 py-2">
              <div className="rounded-md bg-white p-3">
                <QRCodeSVG
                  value={qrModal.url}
                  size={208}
                  marginSize={1}
                  level="M"
                />
              </div>
              <p className="text-center text-xs text-muted-foreground">
                Tap or scan to open Venmo with the payment pre-filled.
              </p>
            </div>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setQrModal(null)}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
