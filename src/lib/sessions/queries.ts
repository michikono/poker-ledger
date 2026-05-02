import { adminDb } from "@/lib/firebase/admin";
import { sortSessions } from "./sort";
import type { SessionStatus, SessionSummary } from "./types";

const VISIBLE_STATUSES: readonly SessionStatus[] = [
  "in_progress",
  "settling",
  "settled",
];

export async function fetchVisibleSessions(): Promise<SessionSummary[]> {
  const groups = await Promise.all(
    VISIBLE_STATUSES.map((status) =>
      adminDb
        .collection("sessions")
        .where("status", "==", status)
        .orderBy("created_at", "desc")
        .get(),
    ),
  );

  const docs = groups.flatMap((snap) => snap.docs);

  const sessions = await Promise.all(
    docs.map(async (doc): Promise<SessionSummary> => {
      const data = doc.data();
      const playerCountSnap = await doc.ref.collection("players").count().get();
      return {
        id: doc.id,
        name: typeof data.name === "string" ? data.name : doc.id,
        status: data.status as SessionStatus,
        createdAt: data.created_at?.toDate?.() ?? new Date(0),
        playerCount: playerCountSnap.data().count,
      };
    }),
  );

  return sortSessions(sessions);
}
