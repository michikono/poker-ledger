"use client";

import { TriangleAlertIcon } from "lucide-react";
import { CONNECTION_COPY, isLive } from "@/lib/realtime/connection-status";
import { useRealtimeStatus } from "./realtime-sync-provider";

// Top-of-page banner shown whenever live sync is stopped (idle or offline).
// Hidden while live. Shared across the index and detail surfaces.
export function StaleSyncBanner() {
  const status = useRealtimeStatus();
  if (isLive(status)) return null;

  const message = CONNECTION_COPY[status].banner;
  if (!message) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="stale-sync-banner"
      className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-foreground"
    >
      <TriangleAlertIcon
        aria-hidden="true"
        className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-500"
      />
      <p>{message}</p>
    </div>
  );
}
