"use client";

import { onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";
import { createContext, type ReactNode, useCallback, useContext } from "react";
import { getClientAuth, getClientDb } from "@/lib/firebase/client";
import type { ConnectionStatus } from "@/lib/realtime/connection-status";
import {
  changeLogQuery,
  sessionsIndexQuery,
  type SubscribeHandlers,
  subscribeToChanges,
} from "@/lib/realtime/subscribe";
import { useRealtimeRefresh } from "@/lib/realtime/use-realtime-refresh";

type RealtimeSync = {
  status: ConnectionStatus;
  reconnect: () => void;
  // Reason the listener is offline (FirebaseError code/message), or null.
  errorReason: string | null;
};

const RealtimeSyncContext = createContext<RealtimeSync>({
  status: "live",
  reconnect: () => {},
  errorReason: null,
});

export function useRealtimeSync(): RealtimeSync {
  return useContext(RealtimeSyncContext);
}

export function useRealtimeStatus(): ConnectionStatus {
  return useContext(RealtimeSyncContext).status;
}

type Props = {
  children: ReactNode;
} & (
  | { target: "session"; sessionId: string }
  | { target: "index"; sessionId?: undefined }
);

// Owns the single realtime hook for a page and publishes its connection status
// + reconnect via context so the header light and the top banner (different DOM
// positions) share one source of truth. Accepts server-rendered children, so
// the page wrapping it can stay a Server Component.
export function RealtimeSyncProvider(props: Props) {
  const { children } = props;
  const router = useRouter();
  const target = props.target;
  const sessionId = props.target === "session" ? props.sessionId : undefined;

  const subscribe = useCallback(
    (handlers: SubscribeHandlers) => {
      const auth = getClientAuth();
      let inner: (() => void) | undefined;

      // Attach the Firestore listener only once auth has resolved a signed-in
      // user, so the listen carries a token (rules require request.auth != null).
      // onAuthStateChanged fires immediately with the current state and again on
      // sign-in/out, covering the cold-load restore race and re-auth. The same
      // handlers are reused across re-attaches; the health signal (onSnapshot)
      // fires on each new listener's initial snapshot, so a re-attach heals a
      // stale error on its own.
      const detachAuth = onAuthStateChanged(auth, (user) => {
        inner?.();
        inner = undefined;
        if (!user) return;
        const db = getClientDb();
        const q =
          target === "session" && sessionId
            ? changeLogQuery(db, sessionId)
            : sessionsIndexQuery(db);
        inner = subscribeToChanges(q, handlers);
      });

      return () => {
        detachAuth();
        inner?.();
      };
    },
    [target, sessionId],
  );

  const { status, reconnect, errorReason } = useRealtimeRefresh({
    subscribe,
    onRefresh: () => router.refresh(),
  });

  return (
    <RealtimeSyncContext.Provider value={{ status, reconnect, errorReason }}>
      {children}
    </RealtimeSyncContext.Provider>
  );
}
