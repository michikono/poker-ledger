"use server";

import { FieldValue } from "firebase-admin/firestore";
import { adminAuth } from "@/lib/auth/admin";
import { getActorFirstName } from "@/lib/auth/actor-name";
import { adminDb } from "@/lib/firebase/admin";
import { generateSessionName } from "@/lib/sessions/name";

const MAX_NAME_RETRIES = 5;
const MAX_AMOUNT_CENTS = 2_000_000;

export type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: { code: string; message: string } };

export type CreateSessionInput = { defaultBuyInCents?: number };

export async function createSession(
  input: CreateSessionInput,
  token: string,
): Promise<ActionResult<{ sessionId: string }>> {
  let decoded: Awaited<ReturnType<typeof adminAuth.verifyIdToken>>;
  try {
    decoded = await adminAuth.verifyIdToken(token);
  } catch {
    return {
      success: false,
      error: { code: "UNAUTHENTICATED", message: "Sign in required." },
    };
  }

  const defaultBuyInCents = input.defaultBuyInCents;
  if (defaultBuyInCents !== undefined) {
    if (
      !Number.isInteger(defaultBuyInCents) ||
      defaultBuyInCents <= 0 ||
      defaultBuyInCents > MAX_AMOUNT_CENTS
    ) {
      return {
        success: false,
        error: { code: "INVALID_AMOUNT", message: "Invalid default buy-in." },
      };
    }
  }

  const actorName = getActorFirstName(decoded);
  const storedDefault = defaultBuyInCents ?? null;

  for (let attempt = 0; attempt < MAX_NAME_RETRIES; attempt++) {
    const name = generateSessionName();
    const sessionRef = adminDb.collection("sessions").doc(name);
    const changelogRef = sessionRef.collection("change_log").doc();
    try {
      await adminDb.runTransaction(async (tx) => {
        const existing = await tx.get(sessionRef);
        if (existing.exists) throw new Error("NAME_COLLISION_RETRY");
        tx.set(sessionRef, {
          name,
          name_lower: name,
          status: "in_progress",
          default_buy_in_cents: storedDefault,
          player_count: 0,
          previous_status: null,
          created_by_uid: decoded.uid,
          created_by_name: actorName,
          created_at: FieldValue.serverTimestamp(),
          updated_at: FieldValue.serverTimestamp(),
        });
        tx.set(changelogRef, {
          actor_uid: decoded.uid,
          actor_name: actorName,
          action_type: "session_created",
          description: `${actorName} created the session.`,
          metadata: { default_buy_in_cents: storedDefault },
          created_at: FieldValue.serverTimestamp(),
        });
      });
      return { success: true, data: { sessionId: name } };
    } catch (err) {
      if (err instanceof Error && err.message === "NAME_COLLISION_RETRY") {
        continue;
      }
      return {
        success: false,
        error: { code: "INTERNAL_ERROR", message: "Unexpected error." },
      };
    }
  }

  return {
    success: false,
    error: {
      code: "NAME_COLLISION",
      message: "Could not generate a unique session name.",
    },
  };
}
