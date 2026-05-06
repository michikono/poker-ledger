"use server";

import { FieldValue } from "firebase-admin/firestore";
import { adminAuth } from "@/lib/auth/admin";
import { getActorFirstName } from "@/lib/auth/actor-name";
import { formatCents } from "@/lib/currency/format";
import { adminDb } from "@/lib/firebase/admin";
import {
  describePlayerNameError,
  validatePlayerName,
} from "@/lib/players/name";
import { computeSettlement } from "@/lib/settlement/compute";
import type { SessionStatus } from "@/lib/sessions/types";
import { parseVenmoHandle } from "@/lib/venmo/url";

const MAX_AMOUNT_CENTS = 2_000_000;

export type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: { code: string; message: string } };

function moneyMd(cents: number): string {
  return `**${formatCents(cents)}**`;
}

function fail(
  code: string,
  message: string,
): {
  success: false;
  error: { code: string; message: string };
} {
  return { success: false, error: { code, message } };
}

const ERR_MESSAGES: Record<string, string> = {
  UNAUTHENTICATED: "Sign in required.",
  SESSION_NOT_FOUND: "Session not found.",
  SESSION_NOT_EDITABLE: "This session can't be edited in its current state.",
  INVALID_STATE_TRANSITION: "Can't perform that action right now.",
  DUPLICATE_PLAYER_NAME: "A player with that name already exists.",
  INVALID_VENMO_USERNAME:
    "Venmo username must be 5–30 characters: letters, digits, _ . or -.",
  PAYMENT_NOT_FOUND: "That payment no longer exists.",
  PLAYER_NOT_FOUND: "That player no longer exists.",
  BUY_IN_NOT_FOUND: "That buy-in no longer exists.",
  INVALID_INPUT: "All players must have a cash-out set.",
  BALANCE_OUT_OF_RANGE: "Cash-outs do not match buy-ins within tolerance.",
  INTERNAL_ERROR: "Unexpected error.",
};

function errFromCode(code: string) {
  return fail(code, ERR_MESSAGES[code] ?? "Unexpected error.");
}

async function authenticate(token: string) {
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    return { ok: true as const, decoded };
  } catch {
    return { ok: false as const };
  }
}

function validateName(
  raw: string,
):
  | { ok: true; trimmed: string; nameLower: string }
  | { ok: false; code: "INVALID_PLAYER_NAME"; message: string } {
  const result = validatePlayerName(raw);
  if (!result.ok) {
    return {
      ok: false,
      code: "INVALID_PLAYER_NAME",
      message: describePlayerNameError(result.error),
    };
  }
  return {
    ok: true,
    trimmed: result.trimmed,
    nameLower: result.trimmed.toLowerCase(),
  };
}

// ============ addPlayer ============

export type AddPlayerInput = {
  sessionId: string;
  name: string;
};

export async function addPlayer(
  input: AddPlayerInput,
  token: string,
): Promise<ActionResult<{ playerId: string }>> {
  const auth = await authenticate(token);
  if (!auth.ok) return errFromCode("UNAUTHENTICATED");

  const validated = validateName(input.name);
  if (!validated.ok) return fail(validated.code, validated.message);

  const { trimmed, nameLower } = validated;
  const actorName = getActorFirstName(auth.decoded);

  try {
    const playerId = await adminDb.runTransaction(async (tx) => {
      const sessionRef = adminDb.collection("sessions").doc(input.sessionId);
      const sessionSnap = await tx.get(sessionRef);

      if (!sessionSnap.exists) throw new Error("SESSION_NOT_FOUND");

      const sessionData = sessionSnap.data();
      if (sessionData?.status !== "in_progress") {
        throw new Error("SESSION_NOT_EDITABLE");
      }

      const playersRef = sessionRef.collection("players");
      const dupeQuery = await tx.get(
        playersRef.where("name_lower", "==", nameLower).limit(1),
      );
      if (!dupeQuery.empty) throw new Error("DUPLICATE_PLAYER_NAME");

      const newPlayerRef = playersRef.doc();
      const defaultBuyIn = sessionData?.default_buy_in_cents ?? null;

      tx.set(newPlayerRef, {
        name: trimmed,
        name_lower: nameLower,
        cash_out_cents: null,
        created_by_uid: auth.decoded.uid,
        created_at: FieldValue.serverTimestamp(),
        updated_at: FieldValue.serverTimestamp(),
      });

      if (typeof defaultBuyIn === "number" && defaultBuyIn > 0) {
        const buyInRef = newPlayerRef.collection("buy_ins").doc();
        tx.set(buyInRef, {
          amount_cents: defaultBuyIn,
          created_by_uid: auth.decoded.uid,
          created_at: FieldValue.serverTimestamp(),
        });
      }

      tx.update(sessionRef, {
        player_count: FieldValue.increment(1),
        updated_at: FieldValue.serverTimestamp(),
      });

      const changelogRef = sessionRef.collection("change_log").doc();
      tx.set(changelogRef, {
        actor_uid: auth.decoded.uid,
        actor_name: actorName,
        action_type: "player_added",
        description: `${actorName} added player ${trimmed}.`,
        metadata: {
          player_id: newPlayerRef.id,
          player_name: trimmed,
        },
        created_at: FieldValue.serverTimestamp(),
      });

      return newPlayerRef.id;
    });

    return { success: true, data: { playerId } };
  } catch (err) {
    if (err instanceof Error && err.message in ERR_MESSAGES) {
      return errFromCode(err.message);
    }
    return errFromCode("INTERNAL_ERROR");
  }
}

// ============ addBuyIn ============

export type AddBuyInInput = {
  sessionId: string;
  playerId: string;
  amountCents: number;
};

export async function addBuyIn(
  input: AddBuyInInput,
  token: string,
): Promise<ActionResult<{ buyInId: string }>> {
  const auth = await authenticate(token);
  if (!auth.ok) return errFromCode("UNAUTHENTICATED");

  if (
    !Number.isInteger(input.amountCents) ||
    input.amountCents <= 0 ||
    input.amountCents > MAX_AMOUNT_CENTS
  ) {
    return fail("INVALID_AMOUNT", "Invalid amount.");
  }

  const actorName = getActorFirstName(auth.decoded);

  try {
    const buyInId = await adminDb.runTransaction(async (tx) => {
      const sessionRef = adminDb.collection("sessions").doc(input.sessionId);
      const sessionSnap = await tx.get(sessionRef);

      if (!sessionSnap.exists) throw new Error("SESSION_NOT_FOUND");
      const sessionData = sessionSnap.data();
      if (sessionData?.status !== "in_progress") {
        throw new Error("SESSION_NOT_EDITABLE");
      }

      const playerRef = sessionRef.collection("players").doc(input.playerId);
      const playerSnap = await tx.get(playerRef);
      if (!playerSnap.exists) throw new Error("PLAYER_NOT_FOUND");

      const buyInRef = playerRef.collection("buy_ins").doc();
      tx.set(buyInRef, {
        amount_cents: input.amountCents,
        created_by_uid: auth.decoded.uid,
        created_at: FieldValue.serverTimestamp(),
      });

      const playerName = (playerSnap.data()?.name as string) ?? "player";
      const changelogRef = sessionRef.collection("change_log").doc();
      tx.set(changelogRef, {
        actor_uid: auth.decoded.uid,
        actor_name: actorName,
        action_type: "buy_in_added",
        description: `${actorName} added ${moneyMd(input.amountCents)} buy-in for ${playerName}.`,
        metadata: {
          player_id: input.playerId,
          amount_cents: input.amountCents,
          buy_in_id: buyInRef.id,
        },
        created_at: FieldValue.serverTimestamp(),
      });

      tx.update(sessionRef, { updated_at: FieldValue.serverTimestamp() });

      return buyInRef.id;
    });

    return { success: true, data: { buyInId } };
  } catch (err) {
    if (err instanceof Error && err.message in ERR_MESSAGES) {
      return errFromCode(err.message);
    }
    return errFromCode("INTERNAL_ERROR");
  }
}

// ============ removeBuyIn ============

export type RemoveBuyInInput = {
  sessionId: string;
  playerId: string;
  buyInId: string;
};

export async function removeBuyIn(
  input: RemoveBuyInInput,
  token: string,
): Promise<ActionResult<void>> {
  const auth = await authenticate(token);
  if (!auth.ok) return errFromCode("UNAUTHENTICATED");

  const actorName = getActorFirstName(auth.decoded);

  try {
    await adminDb.runTransaction(async (tx) => {
      const sessionRef = adminDb.collection("sessions").doc(input.sessionId);
      const sessionSnap = await tx.get(sessionRef);

      if (!sessionSnap.exists) throw new Error("SESSION_NOT_FOUND");
      const sessionData = sessionSnap.data();
      if (sessionData?.status !== "in_progress") {
        throw new Error("SESSION_NOT_EDITABLE");
      }

      const playerRef = sessionRef.collection("players").doc(input.playerId);
      const buyInRef = playerRef.collection("buy_ins").doc(input.buyInId);
      const buyInSnap = await tx.get(buyInRef);
      if (!buyInSnap.exists) throw new Error("BUY_IN_NOT_FOUND");

      const amount = (buyInSnap.data()?.amount_cents as number) ?? 0;
      const playerSnap = await tx.get(playerRef);
      const playerName = (playerSnap.data()?.name as string) ?? "player";

      tx.delete(buyInRef);

      const changelogRef = sessionRef.collection("change_log").doc();
      tx.set(changelogRef, {
        actor_uid: auth.decoded.uid,
        actor_name: actorName,
        action_type: "buy_in_removed",
        description: `${actorName} removed ${moneyMd(amount)} buy-in for ${playerName}.`,
        metadata: {
          player_id: input.playerId,
          amount_cents: amount,
          buy_in_id: input.buyInId,
        },
        created_at: FieldValue.serverTimestamp(),
      });

      tx.update(sessionRef, { updated_at: FieldValue.serverTimestamp() });
    });

    return { success: true, data: undefined };
  } catch (err) {
    if (err instanceof Error && err.message in ERR_MESSAGES) {
      return errFromCode(err.message);
    }
    return errFromCode("INTERNAL_ERROR");
  }
}

// ============ setCashOut ============

export type SetCashOutInput = {
  sessionId: string;
  playerId: string;
  amountCents: number | null;
};

export async function setCashOut(
  input: SetCashOutInput,
  token: string,
): Promise<ActionResult<void>> {
  const auth = await authenticate(token);
  if (!auth.ok) return errFromCode("UNAUTHENTICATED");

  if (input.amountCents !== null) {
    if (
      !Number.isInteger(input.amountCents) ||
      input.amountCents < 0 ||
      input.amountCents > MAX_AMOUNT_CENTS
    ) {
      return fail("INVALID_AMOUNT", "Invalid amount.");
    }
  }

  const actorName = getActorFirstName(auth.decoded);

  try {
    await adminDb.runTransaction(async (tx) => {
      const sessionRef = adminDb.collection("sessions").doc(input.sessionId);
      const sessionSnap = await tx.get(sessionRef);

      if (!sessionSnap.exists) throw new Error("SESSION_NOT_FOUND");
      const sessionData = sessionSnap.data();
      if (sessionData?.status !== "in_progress") {
        throw new Error("SESSION_NOT_EDITABLE");
      }

      const playerRef = sessionRef.collection("players").doc(input.playerId);
      const playerSnap = await tx.get(playerRef);
      if (!playerSnap.exists) throw new Error("PLAYER_NOT_FOUND");

      tx.update(playerRef, {
        cash_out_cents: input.amountCents,
        updated_at: FieldValue.serverTimestamp(),
      });

      const playerName = (playerSnap.data()?.name as string) ?? "player";
      const description =
        input.amountCents === null
          ? `${actorName} cleared cash-out for ${playerName}.`
          : `${actorName} set cash-out for ${playerName} to ${moneyMd(input.amountCents)}.`;

      const changelogRef = sessionRef.collection("change_log").doc();
      tx.set(changelogRef, {
        actor_uid: auth.decoded.uid,
        actor_name: actorName,
        action_type: "cash_out_set",
        description,
        metadata: {
          player_id: input.playerId,
          amount_cents: input.amountCents,
          ...(input.amountCents === null ? { cleared: true } : {}),
        },
        created_at: FieldValue.serverTimestamp(),
      });

      tx.update(sessionRef, { updated_at: FieldValue.serverTimestamp() });
    });

    return { success: true, data: undefined };
  } catch (err) {
    if (err instanceof Error && err.message in ERR_MESSAGES) {
      return errFromCode(err.message);
    }
    return errFromCode("INTERNAL_ERROR");
  }
}

// ============ updatePlayer ============

export type UpdatePlayerInput = {
  sessionId: string;
  playerId: string;
  name: string;
  venmoUsername: string | null;
};

export async function updatePlayer(
  input: UpdatePlayerInput,
  token: string,
): Promise<ActionResult<void>> {
  const auth = await authenticate(token);
  if (!auth.ok) return errFromCode("UNAUTHENTICATED");

  const validated = validateName(input.name);
  if (!validated.ok) return fail(validated.code, validated.message);

  const { trimmed, nameLower } = validated;

  let normalizedHandle: string | null;
  if (input.venmoUsername === null) {
    normalizedHandle = null;
  } else {
    const trimmedHandle = input.venmoUsername.trim();
    if (trimmedHandle === "" || trimmedHandle === "@") {
      normalizedHandle = null;
    } else {
      const parsed = parseVenmoHandle(trimmedHandle);
      if (parsed === null) return errFromCode("INVALID_VENMO_USERNAME");
      normalizedHandle = parsed;
    }
  }

  const actorName = getActorFirstName(auth.decoded);

  try {
    await adminDb.runTransaction(async (tx) => {
      const sessionRef = adminDb.collection("sessions").doc(input.sessionId);
      const sessionSnap = await tx.get(sessionRef);

      if (!sessionSnap.exists) throw new Error("SESSION_NOT_FOUND");
      const sessionData = sessionSnap.data();
      if (sessionData?.status === "archived") {
        throw new Error("SESSION_NOT_EDITABLE");
      }

      const playersRef = sessionRef.collection("players");
      const playerRef = playersRef.doc(input.playerId);
      const playerSnap = await tx.get(playerRef);
      if (!playerSnap.exists) throw new Error("PLAYER_NOT_FOUND");

      const oldData = playerSnap.data() ?? {};
      const oldName = (oldData.name as string) ?? "";
      const oldNameLower = (oldData.name_lower as string) ?? "";
      const oldHandle =
        typeof oldData.venmo_username === "string"
          ? oldData.venmo_username
          : null;

      const nameChanged = oldNameLower !== nameLower;
      const handleChanged = oldHandle !== normalizedHandle;

      if (!nameChanged && !handleChanged) {
        return;
      }

      if (nameChanged) {
        const dupeQuery = await tx.get(
          playersRef.where("name_lower", "==", nameLower).limit(2),
        );
        const collides = dupeQuery.docs.some(
          (d: { id: string }) => d.id !== input.playerId,
        );
        if (collides) throw new Error("DUPLICATE_PLAYER_NAME");
      }

      const updateFields: Record<string, unknown> = {
        updated_at: FieldValue.serverTimestamp(),
      };
      if (nameChanged) {
        updateFields.name = trimmed;
        updateFields.name_lower = nameLower;
      }
      if (handleChanged) {
        updateFields.venmo_username = normalizedHandle;
      }
      tx.update(playerRef, updateFields);

      if (nameChanged) {
        const renameRef = sessionRef.collection("change_log").doc();
        tx.set(renameRef, {
          actor_uid: auth.decoded.uid,
          actor_name: actorName,
          action_type: "player_renamed",
          description: `${actorName} renamed ${oldName} to ${trimmed}.`,
          metadata: {
            player_id: input.playerId,
            from: oldName,
            to: trimmed,
          },
          created_at: FieldValue.serverTimestamp(),
        });
      }

      if (handleChanged) {
        const hadHandle = oldHandle !== null;
        const hasHandle = normalizedHandle !== null;
        const description = !hadHandle
          ? `${actorName} added a Venmo handle for ${trimmed}.`
          : !hasHandle
            ? `${actorName} cleared the Venmo handle for ${trimmed}.`
            : `${actorName} updated the Venmo handle for ${trimmed}.`;
        const venmoRef = sessionRef.collection("change_log").doc();
        tx.set(venmoRef, {
          actor_uid: auth.decoded.uid,
          actor_name: actorName,
          action_type: "player_venmo_updated",
          description,
          metadata: {
            player_id: input.playerId,
            had_handle: hadHandle,
            has_handle: hasHandle,
          },
          created_at: FieldValue.serverTimestamp(),
        });
      }

      tx.update(sessionRef, { updated_at: FieldValue.serverTimestamp() });
    });

    return { success: true, data: undefined };
  } catch (err) {
    if (err instanceof Error && err.message in ERR_MESSAGES) {
      return errFromCode(err.message);
    }
    return errFromCode("INTERNAL_ERROR");
  }
}

// ============ transitionToSettling ============

export type TransitionToSettlingInput = {
  sessionId: string;
};

export type TransitionToSettlingOutput = {
  finalStatus: "settling" | "settled";
  payments: Array<{
    paymentId: string;
    fromPlayerId: string;
    toPlayerId: string;
    amountCents: number;
  }>;
};

export async function transitionToSettling(
  input: TransitionToSettlingInput,
  token: string,
): Promise<ActionResult<TransitionToSettlingOutput>> {
  const auth = await authenticate(token);
  if (!auth.ok) return errFromCode("UNAUTHENTICATED");

  const actorName = getActorFirstName(auth.decoded);

  try {
    const result = await adminDb.runTransaction(async (tx) => {
      const sessionRef = adminDb.collection("sessions").doc(input.sessionId);
      const sessionSnap = await tx.get(sessionRef);

      if (!sessionSnap.exists) throw new Error("SESSION_NOT_FOUND");
      const sessionData = sessionSnap.data();
      if (sessionData?.status !== "in_progress") {
        throw new Error("INVALID_STATE_TRANSITION");
      }

      const playersSnap = await tx.get(
        sessionRef.collection("players").orderBy("created_at", "asc"),
      );

      if (playersSnap.empty) throw new Error("INVALID_INPUT");

      const playerData: Array<{
        id: string;
        name: string;
        cashOutCents: number;
        totalBuyInCents: number;
        createdAtMs: number;
      }> = [];

      for (const playerDoc of playersSnap.docs) {
        const data = playerDoc.data();
        if (
          data?.cash_out_cents === null ||
          data?.cash_out_cents === undefined
        ) {
          throw new Error("INVALID_INPUT");
        }
        const buyinsSnap = await tx.get(
          playerDoc.ref.collection("buy_ins").orderBy("created_at", "asc"),
        );
        let totalBuyInCents = 0;
        for (const d of buyinsSnap.docs) {
          const amt = d.data().amount_cents;
          if (typeof amt === "number") totalBuyInCents += amt;
        }

        const createdAt = data?.created_at as
          | { toMillis?: () => number }
          | undefined;
        const createdAtMs =
          typeof createdAt?.toMillis === "function" ? createdAt.toMillis() : 0;

        playerData.push({
          id: playerDoc.id,
          name: (data?.name as string) ?? "",
          cashOutCents: data.cash_out_cents as number,
          totalBuyInCents,
          createdAtMs,
        });
      }

      const totalBuyIn = playerData.reduce(
        (sum, p) => sum + p.totalBuyInCents,
        0,
      );
      const totalCashOut = playerData.reduce(
        (sum, p) => sum + p.cashOutCents,
        0,
      );

      if (totalBuyIn === 0) throw new Error("BALANCE_OUT_OF_RANGE");

      const shortfall = totalBuyIn - totalCashOut;
      if (shortfall < 0 || shortfall / totalBuyIn > 0.02) {
        throw new Error("BALANCE_OUT_OF_RANGE");
      }

      const computed = computeSettlement(
        playerData.map((p) => ({
          id: p.id,
          createdAtMs: p.createdAtMs,
          totalBuyInCents: p.totalBuyInCents,
          cashOutCents: p.cashOutCents,
        })),
      );

      const paymentRefs: Array<{
        paymentId: string;
        fromPlayerId: string;
        toPlayerId: string;
        amountCents: number;
      }> = [];

      const paymentsRef = sessionRef.collection("payments");
      for (const payment of computed) {
        const paymentRef = paymentsRef.doc();
        tx.set(paymentRef, {
          from_player_id: payment.fromPlayerId,
          to_player_id: payment.toPlayerId,
          amount_cents: payment.amountCents,
          paid: false,
          paid_at: null,
          paid_by_uid: null,
          created_at: FieldValue.serverTimestamp(),
        });
        paymentRefs.push({
          paymentId: paymentRef.id,
          fromPlayerId: payment.fromPlayerId,
          toPlayerId: payment.toPlayerId,
          amountCents: payment.amountCents,
        });
      }

      const finalStatus: "settling" | "settled" =
        computed.length === 0 ? "settled" : "settling";

      tx.update(sessionRef, {
        status: finalStatus,
        updated_at: FieldValue.serverTimestamp(),
      });

      const changelogRef = sessionRef.collection("change_log").doc();
      const reason = computed.length === 0 ? "auto_settle_zero_payments" : null;
      tx.set(changelogRef, {
        actor_uid: auth.decoded.uid,
        actor_name: actorName,
        action_type: "status_changed",
        description: `${actorName} moved session to ${finalStatus}.`,
        metadata: {
          from: "in_progress",
          to: finalStatus,
          ...(reason ? { reason } : {}),
        },
        created_at: FieldValue.serverTimestamp(),
      });

      return { finalStatus, payments: paymentRefs };
    });

    return { success: true, data: result };
  } catch (err) {
    if (err instanceof Error && err.message in ERR_MESSAGES) {
      return errFromCode(err.message);
    }
    return errFromCode("INTERNAL_ERROR");
  }
}

// ============ markPaymentPaid ============

export type MarkPaymentPaidInput = {
  sessionId: string;
  paymentId: string;
};

export async function markPaymentPaid(
  input: MarkPaymentPaidInput,
  token: string,
): Promise<ActionResult<void>> {
  const auth = await authenticate(token);
  if (!auth.ok) return errFromCode("UNAUTHENTICATED");

  const actorName = getActorFirstName(auth.decoded);

  try {
    await adminDb.runTransaction(async (tx) => {
      const sessionRef = adminDb.collection("sessions").doc(input.sessionId);
      const sessionSnap = await tx.get(sessionRef);

      if (!sessionSnap.exists) throw new Error("SESSION_NOT_FOUND");

      const sessionData = sessionSnap.data();
      const status = sessionData?.status as SessionStatus | undefined;
      if (status !== "settling" && status !== "settled") {
        throw new Error("INVALID_STATE_TRANSITION");
      }

      const paymentRef = sessionRef.collection("payments").doc(input.paymentId);
      const paymentSnap = await tx.get(paymentRef);
      if (!paymentSnap.exists) throw new Error("PAYMENT_NOT_FOUND");

      const paymentData = paymentSnap.data() ?? {};
      const wasPaid = paymentData.paid === true;

      // Idempotent — check if any other unpaid before deciding to auto-settle
      let willAutoSettle = false;
      if (status === "settling" && !wasPaid) {
        const unpaidSnap = await tx.get(
          sessionRef.collection("payments").where("paid", "==", false).limit(2),
        );
        const otherUnpaid = unpaidSnap.docs.filter(
          (d: { id: string }) => d.id !== input.paymentId,
        );
        willAutoSettle = otherUnpaid.length === 0;
      }

      if (!wasPaid) {
        tx.update(paymentRef, {
          paid: true,
          paid_at: FieldValue.serverTimestamp(),
          paid_by_uid: auth.decoded.uid,
        });

        const changelogRef = sessionRef.collection("change_log").doc();
        tx.set(changelogRef, {
          actor_uid: auth.decoded.uid,
          actor_name: actorName,
          action_type: "payment_marked_paid",
          description: `${actorName} marked payment of ${moneyMd(paymentData.amount_cents ?? 0)} paid.`,
          metadata: {
            payment_id: input.paymentId,
            from_player_id: paymentData.from_player_id,
            to_player_id: paymentData.to_player_id,
            amount_cents: paymentData.amount_cents,
          },
          seq: 0,
          created_at: FieldValue.serverTimestamp(),
        });
      }

      if (willAutoSettle) {
        tx.update(sessionRef, {
          status: "settled",
          updated_at: FieldValue.serverTimestamp(),
        });

        const statusChangeRef = sessionRef.collection("change_log").doc();
        tx.set(statusChangeRef, {
          actor_uid: auth.decoded.uid,
          actor_name: actorName,
          action_type: "status_changed",
          description: `${actorName} moved session to settled.`,
          metadata: {
            from: "settling",
            to: "settled",
            reason: "payment_marked",
          },
          seq: 1,
          created_at: FieldValue.serverTimestamp(),
        });
      } else {
        tx.update(sessionRef, { updated_at: FieldValue.serverTimestamp() });
      }
    });

    return { success: true, data: undefined };
  } catch (err) {
    if (err instanceof Error && err.message in ERR_MESSAGES) {
      return errFromCode(err.message);
    }
    return errFromCode("INTERNAL_ERROR");
  }
}

// ============ unmarkPaymentPaid ============

export type UnmarkPaymentPaidInput = {
  sessionId: string;
  paymentId: string;
};

export async function unmarkPaymentPaid(
  input: UnmarkPaymentPaidInput,
  token: string,
): Promise<ActionResult<void>> {
  const auth = await authenticate(token);
  if (!auth.ok) return errFromCode("UNAUTHENTICATED");

  const actorName = getActorFirstName(auth.decoded);

  try {
    await adminDb.runTransaction(async (tx) => {
      const sessionRef = adminDb.collection("sessions").doc(input.sessionId);
      const sessionSnap = await tx.get(sessionRef);

      if (!sessionSnap.exists) throw new Error("SESSION_NOT_FOUND");

      const sessionData = sessionSnap.data();
      const status = sessionData?.status as SessionStatus | undefined;
      if (status !== "settling" && status !== "settled") {
        throw new Error("INVALID_STATE_TRANSITION");
      }

      const paymentRef = sessionRef.collection("payments").doc(input.paymentId);
      const paymentSnap = await tx.get(paymentRef);
      if (!paymentSnap.exists) throw new Error("PAYMENT_NOT_FOUND");

      const paymentData = paymentSnap.data() ?? {};

      tx.update(paymentRef, {
        paid: false,
        paid_at: null,
        paid_by_uid: null,
      });

      const changelogRef = sessionRef.collection("change_log").doc();
      tx.set(changelogRef, {
        actor_uid: auth.decoded.uid,
        actor_name: actorName,
        action_type: "payment_unmarked_paid",
        description: `${actorName} marked payment of ${moneyMd(paymentData.amount_cents ?? 0)} unpaid.`,
        metadata: {
          payment_id: input.paymentId,
          from_player_id: paymentData.from_player_id,
          to_player_id: paymentData.to_player_id,
          amount_cents: paymentData.amount_cents,
        },
        created_at: FieldValue.serverTimestamp(),
      });

      if (status === "settled") {
        tx.update(sessionRef, {
          status: "settling",
          updated_at: FieldValue.serverTimestamp(),
        });

        const statusChangeRef = sessionRef.collection("change_log").doc();
        tx.set(statusChangeRef, {
          actor_uid: auth.decoded.uid,
          actor_name: actorName,
          action_type: "status_changed",
          description: `${actorName} moved session to settling.`,
          metadata: {
            from: "settled",
            to: "settling",
            reason: "payment_unmarked",
          },
          created_at: FieldValue.serverTimestamp(),
        });
      } else {
        tx.update(sessionRef, { updated_at: FieldValue.serverTimestamp() });
      }
    });

    return { success: true, data: undefined };
  } catch (err) {
    if (err instanceof Error && err.message in ERR_MESSAGES) {
      return errFromCode(err.message);
    }
    return errFromCode("INTERNAL_ERROR");
  }
}

// ============ rollbackSessionStatus ============

export type RollbackSessionStatusInput = {
  sessionId: string;
  targetStatus: "settling" | "in_progress";
};

export async function rollbackSessionStatus(
  input: RollbackSessionStatusInput,
  token: string,
): Promise<ActionResult<void>> {
  const auth = await authenticate(token);
  if (!auth.ok) return errFromCode("UNAUTHENTICATED");

  if (
    input.targetStatus !== "settling" &&
    input.targetStatus !== "in_progress"
  ) {
    return errFromCode("INVALID_STATE_TRANSITION");
  }

  const actorName = getActorFirstName(auth.decoded);

  try {
    await adminDb.runTransaction(async (tx) => {
      const sessionRef = adminDb.collection("sessions").doc(input.sessionId);
      const sessionSnap = await tx.get(sessionRef);

      if (!sessionSnap.exists) throw new Error("SESSION_NOT_FOUND");
      const sessionData = sessionSnap.data();
      const currentStatus = sessionData?.status as SessionStatus | undefined;

      if (
        input.targetStatus === "in_progress" &&
        currentStatus !== "settling"
      ) {
        throw new Error("INVALID_STATE_TRANSITION");
      }
      if (input.targetStatus === "settling" && currentStatus !== "settled") {
        throw new Error("INVALID_STATE_TRANSITION");
      }

      const paymentsSnap = await tx.get(sessionRef.collection("payments"));

      if (input.targetStatus === "in_progress") {
        for (const paymentDoc of paymentsSnap.docs) {
          tx.delete(paymentDoc.ref);
        }
      } else {
        for (const paymentDoc of paymentsSnap.docs) {
          tx.update(paymentDoc.ref, {
            paid: false,
            paid_at: null,
            paid_by_uid: null,
          });
        }
      }

      tx.update(sessionRef, {
        status: input.targetStatus,
        updated_at: FieldValue.serverTimestamp(),
      });

      const changelogRef = sessionRef.collection("change_log").doc();
      tx.set(changelogRef, {
        actor_uid: auth.decoded.uid,
        actor_name: actorName,
        action_type: "status_changed",
        description: `${actorName} rolled back to ${input.targetStatus}.`,
        metadata: {
          from: currentStatus,
          to: input.targetStatus,
          reason: "manual_rollback",
        },
        created_at: FieldValue.serverTimestamp(),
      });
    });

    return { success: true, data: undefined };
  } catch (err) {
    if (err instanceof Error && err.message in ERR_MESSAGES) {
      return errFromCode(err.message);
    }
    return errFromCode("INTERNAL_ERROR");
  }
}

// ============ archiveSession ============

export type ArchiveSessionInput = {
  sessionId: string;
};

export async function archiveSession(
  input: ArchiveSessionInput,
  token: string,
): Promise<ActionResult<void>> {
  const auth = await authenticate(token);
  if (!auth.ok) return errFromCode("UNAUTHENTICATED");

  const actorName = getActorFirstName(auth.decoded);

  try {
    await adminDb.runTransaction(async (tx) => {
      const sessionRef = adminDb.collection("sessions").doc(input.sessionId);
      const sessionSnap = await tx.get(sessionRef);

      if (!sessionSnap.exists) throw new Error("SESSION_NOT_FOUND");

      const sessionData = sessionSnap.data();
      const currentStatus = sessionData?.status as SessionStatus | undefined;

      if (currentStatus === "archived") {
        throw new Error("INVALID_STATE_TRANSITION");
      }

      tx.update(sessionRef, {
        status: "archived",
        previous_status: currentStatus ?? null,
        updated_at: FieldValue.serverTimestamp(),
      });

      const changelogRef = sessionRef.collection("change_log").doc();
      tx.set(changelogRef, {
        actor_uid: auth.decoded.uid,
        actor_name: actorName,
        action_type: "session_archived",
        description: `${actorName} archived the session.`,
        metadata: {
          previous_status: currentStatus,
        },
        created_at: FieldValue.serverTimestamp(),
      });
    });

    return { success: true, data: undefined };
  } catch (err) {
    if (err instanceof Error && err.message in ERR_MESSAGES) {
      return errFromCode(err.message);
    }
    return errFromCode("INTERNAL_ERROR");
  }
}

// ============ deletePlayer ============

export type DeletePlayerInput = {
  sessionId: string;
  playerId: string;
};

export async function deletePlayer(
  input: DeletePlayerInput,
  token: string,
): Promise<ActionResult<void>> {
  const auth = await authenticate(token);
  if (!auth.ok) return errFromCode("UNAUTHENTICATED");

  const actorName = getActorFirstName(auth.decoded);

  try {
    await adminDb.runTransaction(async (tx) => {
      const sessionRef = adminDb.collection("sessions").doc(input.sessionId);
      const sessionSnap = await tx.get(sessionRef);

      if (!sessionSnap.exists) throw new Error("SESSION_NOT_FOUND");
      const sessionData = sessionSnap.data();
      if (sessionData?.status !== "in_progress") {
        throw new Error("SESSION_NOT_EDITABLE");
      }

      const playerRef = sessionRef.collection("players").doc(input.playerId);
      const playerSnap = await tx.get(playerRef);
      if (!playerSnap.exists) throw new Error("PLAYER_NOT_FOUND");

      const playerName = (playerSnap.data()?.name as string) ?? "player";

      const buyInsSnap = await tx.get(playerRef.collection("buy_ins"));
      for (const buyInDoc of buyInsSnap.docs) {
        tx.delete(buyInDoc.ref);
      }

      tx.delete(playerRef);

      tx.update(sessionRef, {
        player_count: FieldValue.increment(-1),
        updated_at: FieldValue.serverTimestamp(),
      });

      const changelogRef = sessionRef.collection("change_log").doc();
      tx.set(changelogRef, {
        actor_uid: auth.decoded.uid,
        actor_name: actorName,
        action_type: "player_removed",
        description: `${actorName} removed player ${playerName}.`,
        metadata: {
          player_id: input.playerId,
          player_name: playerName,
        },
        created_at: FieldValue.serverTimestamp(),
      });
    });

    return { success: true, data: undefined };
  } catch (err) {
    if (err instanceof Error && err.message in ERR_MESSAGES) {
      return errFromCode(err.message);
    }
    return errFromCode("INTERNAL_ERROR");
  }
}

// ============ updateDefaultBuyIn ============

export type UpdateDefaultBuyInInput = {
  sessionId: string;
  amountCents: number | null;
};

export async function updateDefaultBuyIn(
  input: UpdateDefaultBuyInInput,
  token: string,
): Promise<ActionResult<void>> {
  const auth = await authenticate(token);
  if (!auth.ok) return errFromCode("UNAUTHENTICATED");

  if (input.amountCents !== null) {
    if (
      !Number.isInteger(input.amountCents) ||
      input.amountCents <= 0 ||
      input.amountCents > MAX_AMOUNT_CENTS
    ) {
      return fail("INVALID_AMOUNT", "Invalid amount.");
    }
  }

  const actorName = getActorFirstName(auth.decoded);

  try {
    await adminDb.runTransaction(async (tx) => {
      const sessionRef = adminDb.collection("sessions").doc(input.sessionId);
      const sessionSnap = await tx.get(sessionRef);

      if (!sessionSnap.exists) throw new Error("SESSION_NOT_FOUND");
      const sessionData = sessionSnap.data();
      if (sessionData?.status !== "in_progress") {
        throw new Error("SESSION_NOT_EDITABLE");
      }

      tx.update(sessionRef, {
        default_buy_in_cents: input.amountCents,
        updated_at: FieldValue.serverTimestamp(),
      });

      const changelogRef = sessionRef.collection("change_log").doc();
      const description =
        input.amountCents === null
          ? `${actorName} cleared the default buy-in.`
          : `${actorName} set the default buy-in to ${moneyMd(input.amountCents)}.`;
      tx.set(changelogRef, {
        actor_uid: auth.decoded.uid,
        actor_name: actorName,
        action_type: "default_buy_in_updated",
        description,
        metadata: { amount_cents: input.amountCents },
        created_at: FieldValue.serverTimestamp(),
      });
    });

    return { success: true, data: undefined };
  } catch (err) {
    if (err instanceof Error && err.message in ERR_MESSAGES) {
      return errFromCode(err.message);
    }
    return errFromCode("INTERNAL_ERROR");
  }
}

// ============ unarchiveSession ============

export type UnarchiveSessionInput = {
  sessionId: string;
};

export async function unarchiveSession(
  input: UnarchiveSessionInput,
  token: string,
): Promise<ActionResult<void>> {
  const auth = await authenticate(token);
  if (!auth.ok) return errFromCode("UNAUTHENTICATED");

  const actorName = getActorFirstName(auth.decoded);

  try {
    await adminDb.runTransaction(async (tx) => {
      const sessionRef = adminDb.collection("sessions").doc(input.sessionId);
      const sessionSnap = await tx.get(sessionRef);

      if (!sessionSnap.exists) throw new Error("SESSION_NOT_FOUND");

      const sessionData = sessionSnap.data();
      const currentStatus = sessionData?.status as SessionStatus | undefined;

      if (currentStatus !== "archived") {
        throw new Error("INVALID_STATE_TRANSITION");
      }

      const previousStatus = sessionData?.previous_status as
        | SessionStatus
        | null
        | undefined;

      if (
        !previousStatus ||
        !["in_progress", "settling", "settled"].includes(previousStatus)
      ) {
        throw new Error("INVALID_STATE_TRANSITION");
      }

      tx.update(sessionRef, {
        status: previousStatus,
        previous_status: null,
        updated_at: FieldValue.serverTimestamp(),
      });

      const changelogRef = sessionRef.collection("change_log").doc();
      tx.set(changelogRef, {
        actor_uid: auth.decoded.uid,
        actor_name: actorName,
        action_type: "session_unarchived",
        description: `${actorName} unarchived the session.`,
        metadata: {
          restored_to: previousStatus,
        },
        created_at: FieldValue.serverTimestamp(),
      });
    });

    return { success: true, data: undefined };
  } catch (err) {
    if (err instanceof Error && err.message in ERR_MESSAGES) {
      return errFromCode(err.message);
    }
    return errFromCode("INTERNAL_ERROR");
  }
}
