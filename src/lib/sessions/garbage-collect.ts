"use server";

import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";

const STALE_DAYS = 30;
const NON_ARCHIVED_STATUSES = new Set(["in_progress", "settling", "settled"]);

/**
 * Archives all sessions untouched for more than STALE_DAYS days.
 * Writes a system change-log entry to each archived session.
 * Safe to call fire-and-forget — swallows errors so login is never blocked.
 */
export async function archiveStaleSessionsOnLogin(): Promise<void> {
  try {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - STALE_DAYS);

    const snap = await adminDb
      .collection("sessions")
      .where("updated_at", "<", Timestamp.fromDate(cutoff))
      .get();

    const stale = snap.docs.filter((doc) =>
      NON_ARCHIVED_STATUSES.has(doc.data().status as string),
    );

    if (stale.length === 0) return;

    const batch = adminDb.batch();

    for (const doc of stale) {
      const previousStatus = doc.data().status as string;
      batch.update(doc.ref, {
        status: "archived",
        previous_status: previousStatus,
        updated_at: FieldValue.serverTimestamp(),
      });
      const logRef = doc.ref.collection("change_log").doc();
      batch.set(logRef, {
        actor_uid: "system",
        actor_name: "Poker Ledger",
        action_type: "session_auto_archived",
        description: `Session automatically archived after ${STALE_DAYS} days of inactivity.`,
        metadata: { previous_status: previousStatus },
        created_at: FieldValue.serverTimestamp(),
      });
    }

    await batch.commit();
  } catch {
    // GC failure must never block login.
  }
}
