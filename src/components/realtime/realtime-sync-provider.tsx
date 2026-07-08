"use client";

import { useRouter } from "next/navigation";
import { createContext, type ReactNode, useCallback, useContext } from "react";
import { getClientDb } from "@/lib/firebase/client";
import type { ConnectionStatus } from "@/lib/realtime/connection-status";
import {
  changeLogQuery,
  sessionsIndexQuery,
  subscribeToChanges,
} from "@/lib/realtime/subscribe";
import { useRealtimeRefresh } from "@/lib/realtime/use-realtime-refresh";

const RealtimeStatusContext = createContext<ConnectionStatus>("live");

export function useRealtimeStatus(): ConnectionStatus {
  return useContext(RealtimeStatusContext);
}

type Props = {
  children: ReactNode;
} & (
  | { target: "session"; sessionId: string }
  | { target: "index"; sessionId?: undefined }
);

// Owns the single realtime hook for a page and publishes its connection status
// via context so the header light and the top banner (different DOM positions)
// share one source of truth. Accepts server-rendered children, so the page
// wrapping it can stay a Server Component.
export function RealtimeSyncProvider(props: Props) {
  const { children } = props;
  const router = useRouter();
  const target = props.target;
  const sessionId = props.target === "session" ? props.sessionId : undefined;

  const subscribe = useCallback(
    (onChange: () => void, onError: (error: Error) => void) => {
      const db = getClientDb();
      const q =
        target === "session" && sessionId
          ? changeLogQuery(db, sessionId)
          : sessionsIndexQuery(db);
      return subscribeToChanges(q, onChange, onError);
    },
    [target, sessionId],
  );

  const { status } = useRealtimeRefresh({
    subscribe,
    onRefresh: () => router.refresh(),
  });

  return (
    <RealtimeStatusContext.Provider value={status}>
      {children}
    </RealtimeStatusContext.Provider>
  );
}
