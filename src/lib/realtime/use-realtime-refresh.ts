import { useCallback, useEffect, useRef, useState } from "react";
import {
  type ConnectionStatus,
  deriveConnectionStatus,
  type ListenerHealth,
} from "./connection-status";
import type { SubscribeHandlers, Unsubscribe } from "./subscribe";
import {
  DEFAULT_IDLE_TIMEOUT_MS,
  useActivityStatus,
} from "./use-activity-status";

const DEFAULT_DEBOUNCE_MS = 250;
const RETRY_MS = 5000;

type SubscribeFn = (handlers: SubscribeHandlers) => Unsubscribe;

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
  errorReason: string | null;
} {
  const active = useActivityStatus(idleTimeoutMs);
  const [online, setOnline] = useState(true);
  const [health, setHealth] = useState<ListenerHealth>("connecting");
  // The last listener error's code (or message) — surfaced in the badge popover
  // so a mobile user can see *why* the connection is red. Null when healthy.
  const [errorReason, setErrorReason] = useState<string | null>(null);
  // Bumping this forces the subscription effect to tear down and re-attach —
  // the recovery lever for both auto-retry (on error) and manual reconnect.
  const [reconnectNonce, setReconnectNonce] = useState(0);

  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;
  const subscribeRef = useRef(subscribe);
  subscribeRef.current = subscribe;
  const mountedOnceRef = useRef(false);

  // Force a re-subscribe; the effect re-run resets health to "connecting" and
  // performs the single catch-up refresh (avoids a double refresh here).
  const reconnect = useCallback(() => {
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

    setHealth("connecting");
    setErrorReason(null);

    let debounce: ReturnType<typeof setTimeout> | undefined;
    let retry: ReturnType<typeof setTimeout> | undefined;

    const unsubscribe = subscribeRef.current({
      // Any snapshot — including the initial one delivered right after a
      // (re-)attach — proves the listener is authorized and healthy. This is the
      // sole health-recovery path, independent of whether there's a change to
      // apply, so a listener re-attached by the auth-gated provider clears a
      // stale error even when no further write follows.
      onSnapshot: () => {
        setHealth("live");
        setErrorReason(null);
        clearTimeout(retry);
      },
      // A non-initial snapshot is an actual change: refresh (debounced).
      onChange: () => {
        clearTimeout(debounce);
        debounce = setTimeout(() => onRefreshRef.current(), debounceMs);
      },
      // A listener error surfaces an offline status, then auto-retries by
      // bumping the nonce so this effect re-attaches a fresh listener. Log the
      // underlying FirebaseError: it is the only signal of *why* the listener
      // failed (its `.code` distinguishes auth/rules from transport), and it was
      // previously swallowed here — leaving a red badge undiagnosable.
      onError: (error) => {
        console.error("[realtime] Firestore listener error", error);
        const code = (error as { code?: unknown }).code;
        setErrorReason(typeof code === "string" ? code : error.message);
        setHealth("errored");
        retry = setTimeout(() => setReconnectNonce((n) => n + 1), RETRY_MS);
      },
    });

    return () => {
      clearTimeout(debounce);
      clearTimeout(retry);
      unsubscribe();
    };
  }, [active, online, debounceMs, reconnectNonce]);

  return {
    status: deriveConnectionStatus({ active, online, health }),
    reconnect,
    errorReason,
  };
}
