"use client";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
    <TooltipProvider>
      <ol
        className="flex max-h-80 flex-col gap-3 overflow-y-auto rounded-md border bg-card/50 p-4 md:max-h-[480px]"
        data-testid="activity-log"
      >
        {entries.map((entry) => {
          const absolute = new Date(entry.createdAt).toLocaleString();
          return (
            <li key={entry.id} className="flex flex-col gap-0.5 text-sm">
              <Tooltip>
                <TooltipTrigger
                  render={
                    <button
                      type="button"
                      aria-label={`Logged ${absolute}`}
                      className="w-fit cursor-default rounded text-left text-xs text-muted-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                    />
                  }
                >
                  {formatRelativeTime(entry.createdAt)} · {entry.actorName}
                </TooltipTrigger>
                <TooltipContent>{absolute}</TooltipContent>
              </Tooltip>
              <span>{renderLogDescription(entry.description)}</span>
            </li>
          );
        })}
      </ol>
    </TooltipProvider>
  );
}
