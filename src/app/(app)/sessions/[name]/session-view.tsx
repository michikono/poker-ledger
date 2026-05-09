"use client";

import {
  ArchiveIcon,
  ArchiveRestoreIcon,
  BanknoteIcon,
  MoreHorizontal,
  Pencil,
  Undo2Icon,
} from "lucide-react";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { withToken } from "@/lib/auth/client-token";
import { formatCents } from "@/lib/currency/format";
import { describeErrorCode } from "@/lib/errors/messages";
import { formatLocalIsoDate } from "@/lib/venmo/url";
import { ActivityLog } from "./activity-log";
import {
  archiveSession,
  rollbackSessionStatus,
  unarchiveSession,
} from "./actions";
import { DefaultBuyInModal } from "./default-buy-in-modal";
import type {
  SessionLogView,
  SessionPaymentView,
  SessionPlayerView,
  SessionViewModel,
} from "./page";
import { PaymentList } from "./payment-list";
import type { PlayerRowHandle } from "./player-row";
import { PlayerList } from "./player-list";
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
  const [defaultBuyInOpen, setDefaultBuyInOpen] = useState(false);
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

  // Mobile keeps the primary action visible and collapses secondary actions
  // into a "More" overflow menu. md+ shows them all inline as today.
  type SecondaryAction = {
    key: string;
    label: string;
    icon: typeof Undo2Icon;
    onSelect: () => void;
    destructive?: boolean;
  };
  const secondaryActions: SecondaryAction[] = [];
  if (isSettling || isSettled) {
    secondaryActions.push({
      key: "rollback",
      label: isSettling ? "Roll back to in progress" : "Roll back to settling",
      icon: Undo2Icon,
      onSelect: () => setRollbackOpen(true),
    });
  }
  if (!isArchived) {
    secondaryActions.push({
      key: "archive",
      label: "Archive session",
      icon: ArchiveIcon,
      onSelect: () => setArchiveOpen(true),
    });
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 p-4 md:p-6">
      <header className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-start md:justify-between">
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold md:text-2xl">
              {session.name}
            </h1>
            <StatusBadge status={status} />
          </div>
          <p className="text-sm text-muted-foreground">
            Created by {session.createdByName} on{" "}
            {formatLocalIsoDate(new Date(session.createdAt))}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isInProgress && (
            <Button
              type="button"
              onClick={() => setSettlingOpen(true)}
              disabled={submitting || players.length === 0}
              data-testid="settle-up-button"
              className="flex-1 md:flex-none"
            >
              <BanknoteIcon className="size-4" />
              Settle up
            </Button>
          )}
          {isArchived && (
            <Button
              type="button"
              onClick={() => void handleUnarchive()}
              disabled={submitting}
              className="flex-1 md:flex-none"
            >
              <ArchiveRestoreIcon className="size-4" />
              Unarchive
            </Button>
          )}
          {secondaryActions.length > 0 && (
            <>
              {/* Mobile: overflow menu */}
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button
                      variant="outline"
                      size="icon"
                      aria-label="More actions"
                      data-testid="session-actions-more"
                      className="md:hidden"
                    />
                  }
                >
                  <MoreHorizontal className="size-5" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {secondaryActions.map((action) => {
                    const Icon = action.icon;
                    return (
                      <DropdownMenuItem
                        key={action.key}
                        onClick={action.onSelect}
                        disabled={submitting}
                        variant={action.destructive ? "destructive" : "default"}
                      >
                        <Icon className="size-4" />
                        {action.label}
                      </DropdownMenuItem>
                    );
                  })}
                </DropdownMenuContent>
              </DropdownMenu>
              {/* md+: inline secondary buttons */}
              {secondaryActions.map((action) => {
                const Icon = action.icon;
                return (
                  <Button
                    key={action.key}
                    type="button"
                    variant="outline"
                    onClick={action.onSelect}
                    disabled={submitting}
                    className="hidden md:inline-flex"
                  >
                    <Icon className="size-4" />
                    {action.label}
                  </Button>
                );
              })}
            </>
          )}
        </div>
      </header>

      <PlayerList
        sessionId={session.id}
        status={status}
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

      {/* Default buy-in lives at the bottom — it's a session-wide setting,
          not part of the per-player Add flow. */}
      {isInProgress && (
        <section
          className="flex flex-col gap-2"
          data-testid="default-buy-in-section"
        >
          <h2 className="text-lg font-semibold">Default buy-in</h2>
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-card p-3">
            <p className="text-sm text-muted-foreground">
              {session.defaultBuyInCents && session.defaultBuyInCents > 0 ? (
                <>
                  New players start with{" "}
                  <strong className="font-medium tabular-nums text-foreground">
                    {formatCents(session.defaultBuyInCents)}
                  </strong>
                  .
                </>
              ) : (
                "No default set."
              )}
            </p>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDefaultBuyInOpen(true)}
              data-testid="change-default-buy-in"
            >
              <Pencil className="size-4" />
              {session.defaultBuyInCents && session.defaultBuyInCents > 0
                ? "Change"
                : "Set"}
            </Button>
          </div>
        </section>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Activity</h2>
        <ActivityLog entries={log} />
      </section>

      <DefaultBuyInModal
        open={defaultBuyInOpen}
        onOpenChange={setDefaultBuyInOpen}
        sessionId={session.id}
        defaultBuyInCents={session.defaultBuyInCents}
      />

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
              variant="outline"
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
              <ArchiveIcon className="size-4" />
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
              variant="outline"
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
              <Undo2Icon className="size-4" />
              Roll back
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
