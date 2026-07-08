import { useCallback, useEffect, useRef, useState } from "react";
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
const RETRY_MS = 5000;

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
// a connection status for the UI (light + banner) and a manual `reconnect()`.
export function useRealtimeRefresh({
  subscribe,
  onRefresh,
  idleTimeoutMs = DEFAULT_IDLE_TIMEOUT_MS,
  debounceMs = DEFAULT_DEBOUNCE_MS,
}: UseRealtimeRefreshParams): {
  status: ConnectionStatus;
  reconnect: () => void;
} {
  const active = useActivityStatus(idleTimeoutMs);
  const [online, setOnline] = useState(true);
  const [errored, setErrored] = useState(false);
  // Bumping this forces the subscription effect to tear down and re-attach —
  // the recovery lever for both auto-retry (on error) and manual reconnect.
  const [reconnectNonce, setReconnectNonce] = useState(0);

  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;
  const subscribeRef = useRef(subscribe);
  subscribeRef.current = subscribe;
  const mountedOnceRef = useRef(false);

  // Clear the error and force a re-subscribe; the subscription effect's re-run
  // performs the single catch-up refresh (avoids a double refresh here).
  const reconnect = useCallback(() => {
    setErrored(false);
    setReconnectNonce((n) => n + 1);
  }, []);

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

  // reconnectNonce is a deliberate re-subscribe trigger (auto-retry + manual
  // reconnect); it is intentionally not read in the effect body.
  // biome-ignore lint/correctness/useExhaustiveDependencies: nonce forces re-subscribe
  useEffect(() => {
    if (!active || !online) return;

    // Catch up on (re)entering the live state, but not on the very first mount
    // (the server render is already fresh).
    if (mountedOnceRef.current) onRefreshRef.current();
    else mountedOnceRef.current = true;

    setErrored(false);

    let debounce: ReturnType<typeof setTimeout> | undefined;
    let retry: ReturnType<typeof setTimeout> | undefined;

    const scheduleRefresh = () => {
      clearTimeout(debounce);
      debounce = setTimeout(() => onRefreshRef.current(), debounceMs);
    };
    // A terminal listener error surfaces an offline status, then auto-retries by
    // bumping the nonce so this effect re-attaches a fresh listener.
    const handleError = () => {
      setErrored(true);
      retry = setTimeout(() => setReconnectNonce((n) => n + 1), RETRY_MS);
    };

    const unsubscribe = subscribeRef.current(scheduleRefresh, handleError);

    return () => {
      clearTimeout(debounce);
      clearTimeout(retry);
      unsubscribe();
    };
  }, [active, online, debounceMs, reconnectNonce]);

  return {
    status: deriveConnectionStatus({ active, online, errored }),
    reconnect,
  };
}
