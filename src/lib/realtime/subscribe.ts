import {
  collection,
  type Firestore,
  limit,
  onSnapshot,
  orderBy,
  type Query,
  query,
} from "firebase/firestore";

export type Unsubscribe = () => void;

// Detail surface: the newest change_log entry. Any mutation writes a new entry,
// which becomes the newest doc and fires the listener. limit(1) keeps the
// payload tiny; single-field order needs no composite index.
export function changeLogQuery(db: Firestore, sessionId: string): Query {
  return query(
    collection(db, "sessions", sessionId, "change_log"),
    orderBy("created_at", "desc"),
    limit(1),
  );
}

// Index surface: the sessions the user can list. An add or a status modify
// within the window fires the listener. limit mirrors the index page's fetch
// ceiling (docs/03-architecture.md).
export function sessionsIndexQuery(db: Firestore): Query {
  return query(
    collection(db, "sessions"),
    orderBy("created_at", "desc"),
    limit(200),
  );
}

// Wraps onSnapshot and ignores the initial emission (which carries current
// data, not a change) so mount/resubscribe doesn't trigger a spurious refresh.
// Every subsequent emission calls `onChange`; errors go to `onError`.
export function subscribeToChanges(
  q: Query,
  onChange: () => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  let seenInitial = false;
  return onSnapshot(
    q,
    () => {
      if (!seenInitial) {
        seenInitial = true;
        return;
      }
      onChange();
    },
    (error) => onError?.(error),
  );
}
