"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { filterSessions } from "@/lib/sessions/filter";
import type { SessionSummary } from "@/lib/sessions/types";
import { CreateSessionDialog } from "./create-session-dialog";
import { SessionRow } from "./session-row";

const PAGE_SIZE = 10;

type SerializableSession = Omit<SessionSummary, "createdAt"> & {
  createdAt: string;
};

function deserialize(
  sessions: readonly SerializableSession[],
): SessionSummary[] {
  return sessions.map((s) => ({ ...s, createdAt: new Date(s.createdAt) }));
}

export function SessionList({
  sessions,
}: { sessions: readonly SerializableSession[] }) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);

  const allSessions = useMemo(() => deserialize(sessions), [sessions]);
  const filtered = useMemo(
    () => filterSessions(allSessions, query),
    [allSessions, query],
  );

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const startIndex = (safePage - 1) * PAGE_SIZE;
  const visible = filtered.slice(startIndex, startIndex + PAGE_SIZE);

  if (allSessions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed py-16 text-center">
        <p className="text-muted-foreground">No sessions yet.</p>
        <CreateSessionDialog trigger={<Button>New session</Button>} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <Input
          aria-label="Search sessions"
          placeholder="Search sessions..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setPage(1);
          }}
          className="max-w-sm"
        />
        <CreateSessionDialog trigger={<Button>New session</Button>} />
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed py-12 text-center text-muted-foreground">
          No sessions match your search.
        </div>
      ) : (
        <ul className="rounded-lg border bg-card">
          {visible.map((session) => (
            <SessionRow key={session.id} session={session} />
          ))}
        </ul>
      )}

      {filtered.length > PAGE_SIZE && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Page {safePage} of {pageCount} · {filtered.length} sessions
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={safePage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={safePage >= pageCount}
              onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
