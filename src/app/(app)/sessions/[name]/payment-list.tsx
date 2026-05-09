"use client";

import { Check, QrCode, Undo2Icon } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { VenmoIcon } from "@/components/icons/venmo-icon";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getToken, redirectToSignIn } from "@/lib/auth/client-token";
import { formatCents } from "@/lib/currency/format";
import { describeErrorCode } from "@/lib/errors/messages";
import { buildVenmoPayUrl, formatVenmoNote } from "@/lib/venmo/url";
import { markPaymentPaid, unmarkPaymentPaid } from "./actions";
import type { SessionPaymentView, SessionPlayerView } from "./page";
import type { SessionStatus } from "@/lib/sessions/types";

type QrModalState = {
  paymentId: string;
  payeeName: string;
  payeeHandle: string;
  amountCents: number;
  url: string;
};

type ConfirmModalState = {
  paymentId: string;
  payeeName: string;
  amountCents: number;
};

export function PaymentList({
  sessionId,
  status,
  sessionName,
  sessionCreatedAtIso,
  players,
  payments,
  onRequestEditPlayer,
}: {
  sessionId: string;
  status: SessionStatus;
  sessionName: string;
  sessionCreatedAtIso: string;
  players: SessionPlayerView[];
  payments: SessionPaymentView[];
  onRequestEditPlayer?: (playerId: string) => void;
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [qrModal, setQrModal] = useState<QrModalState | null>(null);
  const [confirmModal, setConfirmModal] = useState<ConfirmModalState | null>(
    null,
  );

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
    toast.error(describeErrorCode(result.error.code));
  }

  async function markPaidById(paymentId: string) {
    const payment = payments.find((p) => p.id === paymentId);
    if (!payment || payment.paid) return;
    await toggle(payment);
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
              className="flex flex-col gap-3 rounded-md border bg-card p-3 md:flex-row md:flex-wrap md:items-center md:justify-between"
              data-testid={`payment-row-${p.id}`}
              data-paid={p.paid ? "true" : "false"}
            >
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 text-sm">
                <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-1 text-sm font-semibold">
                  {fromName}
                </span>
                <span className="text-muted-foreground">pays</span>
                <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-1 text-sm font-semibold">
                  {toName}
                </span>
                <strong className="ml-auto text-base tabular-nums md:ml-0">
                  {formatCents(p.amountCents)}
                </strong>
              </div>
              <div
                className="flex flex-col gap-2 md:flex-row md:flex-wrap md:items-center"
                data-mobile-actions="true"
              >
                {!p.paid && venmoUrl && (
                  <>
                    <a
                      href={venmoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      data-testid={`venmo-pay-${p.id}`}
                      aria-label={`Pay ${toName} ${formatCents(p.amountCents)} on Venmo`}
                      className={cn(
                        buttonVariants({ variant: "outline" }),
                        "w-full md:w-auto",
                      )}
                      onClick={() => {
                        setConfirmModal({
                          paymentId: p.id,
                          payeeName: toName,
                          amountCents: p.amountCents,
                        });
                      }}
                    >
                      <VenmoIcon size={16} title="Venmo" />
                      Pay
                    </a>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        if (!payeeHandle) return;
                        setQrModal({
                          paymentId: p.id,
                          payeeName: toName,
                          payeeHandle,
                          amountCents: p.amountCents,
                          url: venmoUrl,
                        });
                      }}
                      data-testid={`venmo-qr-${p.id}`}
                      className="w-full md:w-auto"
                    >
                      <QrCode className="size-4" />
                      QR
                    </Button>
                  </>
                )}
                {!p.paid && !venmoUrl && toPlayer && onRequestEditPlayer && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => onRequestEditPlayer(toPlayer.id)}
                    data-testid={`add-venmo-cta-${p.id}`}
                    className="w-full md:w-auto"
                  >
                    <VenmoIcon size={16} title="Venmo" />
                    Add Venmo for {toName}
                  </Button>
                )}
                {p.paid && (
                  <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
                    Paid
                  </span>
                )}
                {status === "settled" || p.paid ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void toggle(p)}
                    disabled={isBusy}
                    className="w-full md:w-auto"
                  >
                    <Undo2Icon className="size-4" />
                    {isBusy ? "Working…" : "Unmark"}
                  </Button>
                ) : (
                  <Button
                    type="button"
                    onClick={() => void toggle(p)}
                    disabled={isBusy}
                    data-testid={`mark-paid-${p.id}`}
                    className="w-full md:w-auto"
                  >
                    <Check className="size-4" />
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
          if (open || !qrModal) return;
          // When the QR modal closes, hand off to the confirm modal so the
          // user has to explicitly choose whether they paid.
          const next: ConfirmModalState = {
            paymentId: qrModal.paymentId,
            payeeName: qrModal.payeeName,
            amountCents: qrModal.amountCents,
          };
          setQrModal(null);
          setConfirmModal(next);
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
                Scanning opens Venmo only — you'll still need to mark this
                payment paid here after.
              </p>
            </div>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                if (!qrModal) return;
                const next: ConfirmModalState = {
                  paymentId: qrModal.paymentId,
                  payeeName: qrModal.payeeName,
                  amountCents: qrModal.amountCents,
                };
                setQrModal(null);
                setConfirmModal(next);
              }}
            >
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={confirmModal !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmModal(null);
        }}
      >
        <DialogContent
          data-testid="venmo-confirm-dialog"
          className="sm:max-w-sm"
        >
          <DialogHeader>
            <DialogTitle>Did you complete the Venmo payment?</DialogTitle>
            {confirmModal && (
              <DialogDescription>
                Opening Venmo doesn't mark this payment paid in the ledger. If
                you finished sending {confirmModal.payeeName}{" "}
                <strong className="tabular-nums">
                  {formatCents(confirmModal.amountCents)}
                </strong>
                , mark it paid now.
              </DialogDescription>
            )}
          </DialogHeader>
          <DialogFooter className="sm:justify-between">
            <Button
              type="button"
              variant="outline"
              onClick={() => setConfirmModal(null)}
              data-testid="venmo-confirm-not-yet"
            >
              Did not pay yet
            </Button>
            <Button
              type="button"
              onClick={() => {
                if (!confirmModal) return;
                const id = confirmModal.paymentId;
                setConfirmModal(null);
                void markPaidById(id);
              }}
              data-testid="venmo-confirm-mark-paid"
            >
              Mark paid
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
