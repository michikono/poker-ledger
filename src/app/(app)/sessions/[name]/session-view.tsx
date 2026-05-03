"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getClientAuth } from "@/lib/firebase/client";
import { ActivityLog } from "./activity-log";
import {
  archiveSession,
  rollbackSessionStatus,
  unarchiveSession,
} from "./actions";
import type {
  SessionLogView,
  SessionPaymentView,
  SessionPlayerView,
  SessionViewModel,
} from "./page";
import { PaymentList } from "./payment-list";
import { PlayerTable } from "./player-table";
import { SettlingModal } from "./settling-modal";

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

export function handleErrorCode(code: string): string {
  switch (code) {
    case "UNAUTHENTICATED":
      return "Session expired — please sign in again.";
    case "SESSION_NOT_FOUND":
      return "Session not found.";
    case "SESSION_NOT_EDITABLE":
      return "This session can't be edited in its current state.";
    case "INVALID_STATE_TRANSITION":
      return "Can't perform that action right now.";
    case "PAYMENT_NOT_FOUND":
    case "PLAYER_NOT_FOUND":
    case "BUY_IN_NOT_FOUND":
      return "Some data is out of date — refreshing.";
    default:
      return GENERIC_ERROR;
  }
}

export function SessionView({
  session,
  players,
  payments,
  log,
}: {
  session: SessionViewModel;
  players: SessionPlayerView[];
  payments: SessionPaymentView[];
  log: SessionLogView[];
}) {
  const router = useRouter();
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [rollbackOpen, setRollbackOpen] = useState(false);
  const [settlingOpen, setSettlingOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const status = session.status;
  const isInProgress = status === "in_progress";
  const isSettling = status === "settling";
  const isSettled = status === "settled";
  const isArchived = status === "archived";

  async function withToken<T>(
    fn: (token: string) => Promise<T>,
  ): Promise<T | null> {
    const token = await getToken();
    if (!token) {
      redirectToSignIn();
      return null;
    }
    return await fn(token);
  }

  async function handleArchive() {
    if (submitting) return;
    setSubmitting(true);
    const result = await withToken((token) =>
      archiveSession({ sessionId: session.id }, token),
    );
    setSubmitting(false);
    setArchiveOpen(false);
    if (!result) return;
    if (result.success) {
      router.refresh();
    } else {
      toast.error(handleErrorCode(result.error.code));
    }
  }

  async function handleUnarchive() {
    if (submitting) return;
    setSubmitting(true);
    const result = await withToken((token) =>
      unarchiveSession({ sessionId: session.id }, token),
    );
    setSubmitting(false);
    if (!result) return;
    if (result.success) {
      router.refresh();
    } else {
      toast.error(handleErrorCode(result.error.code));
    }
  }

  async function handleRollback() {
    if (submitting) return;
    const target = isSettling ? "in_progress" : "settling";
    setSubmitting(true);
    const result = await withToken((token) =>
      rollbackSessionStatus(
        { sessionId: session.id, targetStatus: target },
        token,
      ),
    );
    setSubmitting(false);
    setRollbackOpen(false);
    if (!result) return;
    if (result.success) {
      router.refresh();
    } else {
      toast.error(handleErrorCode(result.error.code));
    }
  }

  const showZeroPaymentBanner =
    (isSettled || isSettling) && payments.length === 0;

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 p-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold">{session.name}</h1>
            <StatusBadge status={status} />
          </div>
          <p className="text-sm text-muted-foreground">
            Created by {session.createdByName}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isInProgress && (
            <Button
              type="button"
              onClick={() => setSettlingOpen(true)}
              disabled={submitting || players.length === 0}
              data-testid="settle-up-button"
            >
              Settle up
            </Button>
          )}
          {(isSettling || isSettled) && (
            <Button
              type="button"
              variant="outline"
              onClick={() => setRollbackOpen(true)}
              disabled={submitting}
            >
              {isSettling
                ? "Roll back to in progress"
                : "Roll back to settling"}
            </Button>
          )}
          {!isArchived && (
            <Button
              type="button"
              variant="outline"
              onClick={() => setArchiveOpen(true)}
              disabled={submitting}
            >
              Archive session
            </Button>
          )}
          {isArchived && (
            <Button
              type="button"
              onClick={() => void handleUnarchive()}
              disabled={submitting}
            >
              Unarchive
            </Button>
          )}
        </div>
      </header>

      <PlayerTable
        sessionId={session.id}
        status={status}
        defaultBuyInCents={session.defaultBuyInCents}
        players={players}
      />

      {(isSettling || isSettled) && (
        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold">Settle up</h2>
          {showZeroPaymentBanner ? (
            <p className="rounded-md border border-dashed bg-muted/40 p-4 text-sm text-muted-foreground">
              Everyone broke even — nothing to settle.
            </p>
          ) : (
            <PaymentList
              sessionId={session.id}
              status={status}
              players={players}
              payments={payments}
            />
          )}
        </section>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Activity</h2>
        <ActivityLog entries={log} />
      </section>

      <SettlingModal
        open={settlingOpen}
        onOpenChange={setSettlingOpen}
        sessionId={session.id}
        players={players}
      />

      <Dialog open={archiveOpen} onOpenChange={setArchiveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Archive this session?</DialogTitle>
            <DialogDescription>
              It will be hidden from the index and can be restored from the
              Archived section.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setArchiveOpen(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void handleArchive()}
              disabled={submitting}
            >
              Archive
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={rollbackOpen} onOpenChange={setRollbackOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Roll back to {isSettling ? "in progress" : "settling"}?
            </DialogTitle>
            <DialogDescription>
              {isSettling
                ? "This deletes the computed payments. The session returns to in-progress and you can edit buy-ins and cash-outs."
                : "This unmarks every paid payment and returns the session to settling."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setRollbackOpen(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void handleRollback()}
              disabled={submitting}
            >
              Roll back
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
