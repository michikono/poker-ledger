import { adminDb } from "@/lib/firebase/admin";
import type { SessionStatus, SessionSummary } from "./types";

export type NavCounts = {
  in_progress: number;
  settling: number;
};

async function docToSummary(
  doc: FirebaseFirestore.QueryDocumentSnapshot,
): Promise<SessionSummary> {
  const data = doc.data();
  const playerCountSnap = await doc.ref.collection("players").count().get();
  return {
    id: doc.id,
    name: typeof data.name === "string" ? data.name : doc.id,
    status: data.status as SessionStatus,
    createdAt: data.created_at?.toDate?.() ?? new Date(0),
    playerCount: playerCountSnap.data().count,
  };
}

export async function fetchSessionsByStatus(
  status: SessionStatus,
): Promise<SessionSummary[]> {
  const snap = await adminDb
    .collection("sessions")
    .where("status", "==", status)
    .orderBy("created_at", "desc")
    .get();
  return Promise.all(snap.docs.map(docToSummary));
}

export async function fetchAllStatusGroups(): Promise<
  Record<SessionStatus, SessionSummary[]>
> {
  const [in_progress, settling, settled, archived] = await Promise.all([
    fetchSessionsByStatus("in_progress"),
    fetchSessionsByStatus("settling"),
    fetchSessionsByStatus("settled"),
    fetchSessionsByStatus("archived"),
  ]);
  return { in_progress, settling, settled, archived };
}

export async function fetchNavCounts(): Promise<NavCounts> {
  const [inProgressSnap, settlingSnap] = await Promise.all([
    adminDb
      .collection("sessions")
      .where("status", "==", "in_progress")
      .count()
      .get(),
    adminDb
      .collection("sessions")
      .where("status", "==", "settling")
      .count()
      .get(),
  ]);
  return {
    in_progress: inProgressSnap.data().count,
    settling: settlingSnap.data().count,
  };
}
