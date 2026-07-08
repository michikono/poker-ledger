import { useEffect, useRef, useState } from "react";
import {
  type ConnectionStatus,
  deriveConnectionStatus,
} from "./connection-status";
import type { Unsubscribe } from "./subscribe";
import {
  DEFAULT_IDLE_TIMEOUT_MS,
  useActivityStatus,
} from "./use-activity-status";

const DEFAULT_DEBOUNCE_MS = 250;

type SubscribeFn = (
  onChange: () => void,
  onError: (error: Error) => void,
) => Unsubscribe;

export type UseRealtimeRefreshParams = {
  // Attaches the realtime listener; returns its unsubscribe. Injected so the
  // hook is testable without Firestore.
  subscribe: SubscribeFn;
  // Applies the update — defaults to router.refresh() at the call site.
  onRefresh: () => void;
  idleTimeoutMs?: number;
  debounceMs?: number;
};

// Keeps a surface live while the user is active and online: subscribes to
// realtime changes and (debounced) calls onRefresh on each. Stops when idle;
// resumes with a single catch-up refresh on reactivation or reconnect. Reports
// a connection status for the UI (light + banner).
export function useRealtimeRefresh({
  subscribe,
  onRefresh,
  idleTimeoutMs = DEFAULT_IDLE_TIMEOUT_MS,
  debounceMs = DEFAULT_DEBOUNCE_MS,
}: UseRealtimeRefreshParams): { status: ConnectionStatus } {
  const active = useActivityStatus(idleTimeoutMs);
  const [online, setOnline] = useState(true);
  const [errored, setErrored] = useState(false);

  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;
  const subscribeRef = useRef(subscribe);
  subscribeRef.current = subscribe;
  const mountedOnceRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setOnline(navigator.onLine);
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  useEffect(() => {
    if (!active || !online) return;

    // Catch up on (re)entering the live state, but not on the very first mount
    // (the server render is already fresh).
    if (mountedOnceRef.current) onRefreshRef.current();
    else mountedOnceRef.current = true;

    setErrored(false);

    let debounce: ReturnType<typeof setTimeout> | undefined;

    const scheduleRefresh = () => {
      clearTimeout(debounce);
      debounce = setTimeout(() => onRefreshRef.current(), debounceMs);
    };
    // On error we surface an offline status; recovery re-subscribes on the next
    // online/offline change or idle→active transition (which re-run this effect).
    const handleError = () => setErrored(true);

    const unsubscribe = subscribeRef.current(scheduleRefresh, handleError);

    return () => {
      clearTimeout(debounce);
      unsubscribe();
    };
  }, [active, online, debounceMs]);

  return { status: deriveConnectionStatus({ active, online, errored }) };
}
