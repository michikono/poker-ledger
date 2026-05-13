"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  STATUS_EMPTY_MESSAGES,
  STATUS_LABELS,
  type SessionStatus,
  type SessionSummary,
} from "@/lib/sessions/types";
import { CreateSessionDialog } from "./create-session-dialog";
import { SessionRow } from "./session-row";

function FirstRunEmptyState() {
  return (
    <div
      className="flex flex-col items-center gap-3 rounded-lg border border-dashed bg-card/50 p-8 text-center"
      data-testid="sessions-first-run"
    >
      <h2 className="text-lg font-semibold">Track your first session</h2>
      <p className="max-w-sm text-sm text-muted-foreground">
        Start a session, add players as the night goes on, then settle up when
        the game's done.
      </p>
      <CreateSessionDialog trigger={<Button>New session</Button>} />
    </div>
  );
}

type SerializableSession = Omit<SessionSummary, "createdAt"> & {
  createdAt: string;
};

function deserialize(
  sessions: readonly SerializableSession[],
): SessionSummary[] {
  return sessions.map((s) => ({ ...s, createdAt: new Date(s.createdAt) }));
}

const STATUS_ORDER: readonly SessionStatus[] = [
  "in_progress",
  "settling",
  "settled",
  "archived",
];

function StatusSection({
  status,
  sessions,
}: {
  status: SessionStatus;
  sessions: readonly SerializableSession[];
}) {
  const deserialized = useMemo(() => deserialize(sessions), [sessions]);
  return (
    <section>
      <h2 className="mb-2 text-base font-semibold">{STATUS_LABELS[status]}</h2>
      {deserialized.length === 0 ? (
        <p className="rounded-lg border border-dashed py-6 text-center text-sm text-muted-foreground">
          {STATUS_EMPTY_MESSAGES[status]}
        </p>
      ) : (
        <ul className="rounded-lg border bg-card">
          {deserialized.map((session) => (
            <SessionRow key={session.id} session={session} />
          ))}
        </ul>
      )}
    </section>
  );
}

type DefaultProps = {
  mode: "all";
  groups: Record<SessionStatus, readonly SerializableSession[]>;
};

type FilteredProps = {
  mode: "filtered";
  filter?: SessionStatus;
  sessions: readonly SerializableSession[];
  currentPage: number;
  totalCount: number;
  pageSize: number;
};

export type SessionListProps = DefaultProps | FilteredProps;

export function SessionList(props: SessionListProps) {
  if (props.mode === "filtered") {
    return <SessionListFiltered {...props} />;
  }
  return <SessionListDefault {...props} />;
}

function SessionListDefault({ groups }: DefaultProps) {
  const totalSessions = STATUS_ORDER.reduce(
    (sum, s) => sum + groups[s].length,
    0,
  );

  if (totalSessions === 0) {
    return <FirstRunEmptyState />;
  }

  return (
    <div className="flex flex-col gap-6">
      {STATUS_ORDER.map((status) => (
        <StatusSection key={status} status={status} sessions={groups[status]} />
      ))}
    </div>
  );
}

function pageUrl(filter: SessionStatus | undefined, page: number): string {
  if (filter) return `/sessions?status=${filter}&page=${page}`;
  return `/sessions?page=${page}`;
}

function SessionListFiltered({
  filter,
  sessions,
  currentPage,
  totalCount,
  pageSize,
}: FilteredProps) {
  const pageCount = Math.max(1, Math.ceil(totalCount / pageSize));
  const deserialized = useMemo(() => deserialize(sessions), [sessions]);

  return (
    <div className="flex flex-col gap-4">
      {deserialized.length === 0 ? (
        filter ? (
          <div className="rounded-lg border border-dashed py-12 text-center text-muted-foreground">
            {STATUS_EMPTY_MESSAGES[filter]}
          </div>
        ) : (
          <FirstRunEmptyState />
        )
      ) : (
        <ul className="rounded-lg border bg-card">
          {deserialized.map((session) => (
            <SessionRow key={session.id} session={session} />
          ))}
        </ul>
      )}

      {totalCount > pageSize && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Page {currentPage} of {pageCount} · {totalCount} sessions
          </span>
          <div className="flex gap-2">
            {currentPage <= 1 ? (
              <span
                className={cn(
                  buttonVariants({ variant: "outline" }),
                  "pointer-events-none opacity-50",
                )}
              >
                Previous
              </span>
            ) : (
              <Link
                href={pageUrl(filter, currentPage - 1)}
                className={cn(buttonVariants({ variant: "outline" }))}
              >
                Previous
              </Link>
            )}
            {currentPage >= pageCount ? (
              <span
                className={cn(
                  buttonVariants({ variant: "outline" }),
                  "pointer-events-none opacity-50",
                )}
              >
                Next
              </span>
            ) : (
              <Link
                href={pageUrl(filter, currentPage + 1)}
                className={cn(buttonVariants({ variant: "outline" }))}
              >
                Next
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
