"use client";

import { formatRelativeTime, renderLogDescription } from "./format-log";
import type { SessionLogView } from "./page";

export function ActivityLog({ entries }: { entries: SessionLogView[] }) {
  if (entries.length === 0) {
    return (
      <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
        No activity yet.
      </p>
    );
  }
  return (
    <ol
      className="flex max-h-80 flex-col gap-3 overflow-y-auto rounded-md border bg-card/50 p-4 md:max-h-[480px]"
      data-testid="activity-log"
    >
      {entries.map((entry) => (
        <li key={entry.id} className="flex flex-col gap-0.5 text-sm">
          <span className="text-xs text-muted-foreground">
            {formatRelativeTime(entry.createdAt)} · {entry.actorName}
          </span>
          <span>{renderLogDescription(entry.description)}</span>
        </li>
      ))}
    </ol>
  );
}
