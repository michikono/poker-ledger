"use client";

import { TriangleAlertIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { CONNECTION_COPY, isLive } from "@/lib/realtime/connection-status";
import { useRealtimeSync } from "./realtime-sync-provider";

// How long the connection must stay non-live (while the tab is visible) before
// the banner appears. Keeps momentary blips — and lock/unlock reconnects — from
// flashing the banner and shifting layout. The light reacts immediately.
const BANNER_SHOW_DELAY_MS = 10_000;

// Top-of-page banner shown when live sync is stopped (idle or offline). Debounced
// and visibility-aware: it only appears after the connection has been non-live
// for BANNER_SHOW_DELAY_MS of *visible* time, and the delay restarts whenever the
// tab becomes visible — so unlocking the phone and reconnecting never flashes it.
export function StaleSyncBanner() {
  const { status, reconnect } = useRealtimeSync();
  const live = isLive(status);
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (live) {
      setShow(false);
      return;
    }
    if (typeof document === "undefined") return;

    let timer: ReturnType<typeof setTimeout> | undefined;
    const arm = () => {
      clearTimeout(timer);
      if (document.visibilityState !== "visible") {
        setShow(false);
        return;
      }
      timer = setTimeout(() => setShow(true), BANNER_SHOW_DELAY_MS);
    };
    const onVisibility = () => {
      // A hidden tab never arms; becoming visible restarts the delay, so a
      // resume that reconnects within the window shows nothing.
      setShow(false);
      arm();
    };

    arm();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [live]);

  if (!show) return null;

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
      <div className="flex flex-1 flex-col">
        <p>{message}</p>
        <button
          type="button"
          onClick={reconnect}
          data-testid="stale-sync-refresh-now"
          className="inline-flex min-h-11 items-center self-start font-medium text-primary underline underline-offset-4 outline-none focus-visible:ring-3 focus-visible:ring-ring/50 md:min-h-0"
        >
          Refresh now
        </button>
      </div>
    </div>
  );
}
