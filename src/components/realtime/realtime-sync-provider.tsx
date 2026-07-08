"use client";

import { onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";
import { createContext, type ReactNode, useCallback, useContext } from "react";
import { getClientAuth, getClientDb } from "@/lib/firebase/client";
import type { ConnectionStatus } from "@/lib/realtime/connection-status";
import {
  changeLogQuery,
  sessionsIndexQuery,
  subscribeToChanges,
} from "@/lib/realtime/subscribe";
import { useRealtimeRefresh } from "@/lib/realtime/use-realtime-refresh";

type RealtimeSync = {
  status: ConnectionStatus;
  reconnect: () => void;
};

const RealtimeSyncContext = createContext<RealtimeSync>({
  status: "live",
  reconnect: () => {},
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
    (onChange: () => void, onError: (error: Error) => void) => {
      const auth = getClientAuth();
      let inner: (() => void) | undefined;

      // Attach the Firestore listener only once auth has resolved a signed-in
      // user, so the listen carries a token (rules require request.auth != null).
      // onAuthStateChanged fires immediately with the current state and again on
      // sign-in/out, covering the cold-load restore race and re-auth.
      const detachAuth = onAuthStateChanged(auth, (user) => {
        inner?.();
        inner = undefined;
        if (!user) return;
        const db = getClientDb();
        const q =
          target === "session" && sessionId
            ? changeLogQuery(db, sessionId)
            : sessionsIndexQuery(db);
        inner = subscribeToChanges(q, onChange, onError);
      });

      return () => {
        detachAuth();
        inner?.();
      };
    },
    [target, sessionId],
  );

  const { status, reconnect } = useRealtimeRefresh({
    subscribe,
    onRefresh: () => router.refresh(),
  });

  return (
    <RealtimeSyncContext.Provider value={{ status, reconnect }}>
      {children}
    </RealtimeSyncContext.Provider>
  );
}
