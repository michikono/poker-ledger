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

export type SubscribeHandlers = {
  // Fires on every emission, including the initial one. A delivered snapshot is
  // proof the listener is authorized and healthy, so this drives connection
  // health independently of whether there's a change to apply.
  onSnapshot: () => void;
  // Fires only on non-initial emissions (an actual change). The initial snapshot
  // carries current data, not a change, so it must not trigger a refresh.
  onChange: () => void;
  onError?: (error: Error) => void;
};

// Wraps onSnapshot, separating two concerns that must not be conflated:
// `onSnapshot` (health — every emission) and `onChange` (refresh — non-initial
// emissions only). Ignoring the initial emission for `onChange` keeps
// mount/resubscribe from triggering a spurious refresh, while still surfacing
// that first snapshot as a health signal.
export function subscribeToChanges(
  q: Query,
  { onSnapshot: onSnap, onChange, onError }: SubscribeHandlers,
): Unsubscribe {
  let seenInitial = false;
  return onSnapshot(
    q,
    () => {
      onSnap();
      if (!seenInitial) {
        seenInitial = true;
        return;
      }
      onChange();
    },
    (error) => onError?.(error),
  );
}
