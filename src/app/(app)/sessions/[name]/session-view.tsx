"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
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
import { withToken } from "@/lib/auth/client-token";
import { describeErrorCode } from "@/lib/errors/messages";
import { formatLocalIsoDate } from "@/lib/venmo/url";
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
import type { PlayerRowHandle } from "./player-row";
import { PlayerTable } from "./player-table";
import { SettlingModal } from "./settling-modal";

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
  const playerRowsRef = useRef<Map<string, PlayerRowHandle>>(new Map());

  const status = session.status;
  const isInProgress = status === "in_progress";
  const isSettling = status === "settling";
  const isSettled = status === "settled";
  const isArchived = status === "archived";

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
      toast.error(describeErrorCode(result.error.code));
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
      toast.error(describeErrorCode(result.error.code));
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
      toast.error(describeErrorCode(result.error.code));
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
            Created by {session.createdByName} on{" "}
            {formatLocalIsoDate(new Date(session.createdAt))}
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
        playerRowsRef={playerRowsRef}
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
              sessionName={session.name}
              sessionCreatedAtIso={session.createdAt}
              players={players}
              payments={payments}
              onRequestEditPlayer={(playerId) =>
                playerRowsRef.current
                  .get(playerId)
                  ?.openEdit({ focus: "venmo" })
              }
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
