import { notFound } from "next/navigation";
import { adminDb } from "@/lib/firebase/admin";
import type { SessionStatus } from "@/lib/sessions/types";
import { SessionView } from "./session-view";

const VALID_STATUSES: ReadonlySet<SessionStatus> = new Set([
  "in_progress",
  "settling",
  "settled",
  "archived",
]);

function asSessionStatus(value: unknown): SessionStatus {
  return typeof value === "string" && VALID_STATUSES.has(value as SessionStatus)
    ? (value as SessionStatus)
    : "in_progress";
}

function tsToIso(value: unknown): string {
  if (value && typeof value === "object" && "toDate" in value) {
    const d = (value as { toDate: () => Date }).toDate();
    return d.toISOString();
  }
  if (value instanceof Date) return value.toISOString();
  return new Date(0).toISOString();
}

export type SessionPlayerView = {
  id: string;
  name: string;
  cashOutCents: number | null;
  createdAt: string;
  buyIns: Array<{ id: string; amountCents: number; createdAt: string }>;
};

export type SessionPaymentView = {
  id: string;
  fromPlayerId: string;
  toPlayerId: string;
  amountCents: number;
  paid: boolean;
  paidAt: string | null;
  paidByUid: string | null;
  createdAt: string;
};

export type SessionLogView = {
  id: string;
  actorUid: string;
  actorName: string;
  actionType: string;
  description: string;
  createdAt: string;
};

export type SessionViewModel = {
  id: string;
  name: string;
  status: SessionStatus;
  previousStatus: SessionStatus | null;
  defaultBuyInCents: number | null;
  createdAt: string;
  createdByName: string;
};

export default async function SessionPage({
  params,
}: {
  params: Promise<{ name: string }>;
}) {
  const { name } = await params;
  const sessionRef = adminDb.collection("sessions").doc(name);

  const [sessionSnap, playersSnap, paymentsSnap, logSnap] = await Promise.all([
    sessionRef.get(),
    sessionRef.collection("players").orderBy("created_at", "asc").get(),
    sessionRef.collection("payments").orderBy("created_at", "asc").get(),
    sessionRef
      .collection("change_log")
      .orderBy("created_at", "desc")
      .limit(200)
      .get(),
  ]);

  if (!sessionSnap.exists) notFound();

  const sessionData = sessionSnap.data() ?? {};

  const buyInsByPlayer = await Promise.all(
    playersSnap.docs.map(async (doc) => {
      const buyInsSnap = await doc.ref
        .collection("buy_ins")
        .orderBy("created_at", "asc")
        .get();
      return buyInsSnap.docs.map((b) => ({
        id: b.id,
        amountCents: (b.data().amount_cents as number) ?? 0,
        createdAt: tsToIso(b.data().created_at),
      }));
    }),
  );

  const players: SessionPlayerView[] = playersSnap.docs.map((doc, i) => {
    const data = doc.data();
    return {
      id: doc.id,
      name: (data.name as string) ?? "",
      cashOutCents:
        typeof data.cash_out_cents === "number" ? data.cash_out_cents : null,
      createdAt: tsToIso(data.created_at),
      buyIns: buyInsByPlayer[i] ?? [],
    };
  });

  const payments: SessionPaymentView[] = paymentsSnap.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      fromPlayerId: (data.from_player_id as string) ?? "",
      toPlayerId: (data.to_player_id as string) ?? "",
      amountCents: (data.amount_cents as number) ?? 0,
      paid: data.paid === true,
      paidAt: data.paid_at ? tsToIso(data.paid_at) : null,
      paidByUid: typeof data.paid_by_uid === "string" ? data.paid_by_uid : null,
      createdAt: tsToIso(data.created_at),
    };
  });

  const sortedLogDocs = [...logSnap.docs].sort((a, b) => {
    const aData = a.data();
    const bData = b.data();
    const aTime = aData.created_at?.toMillis?.() ?? 0;
    const bTime = bData.created_at?.toMillis?.() ?? 0;
    if (bTime !== aTime) return bTime - aTime;
    const aSeq = typeof aData.seq === "number" ? aData.seq : 0;
    const bSeq = typeof bData.seq === "number" ? bData.seq : 0;
    return bSeq - aSeq;
  });

  const log: SessionLogView[] = sortedLogDocs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      actorUid: (data.actor_uid as string) ?? "",
      actorName: (data.actor_name as string) ?? "Anonymous",
      actionType: (data.action_type as string) ?? "",
      description: (data.description as string) ?? "",
      createdAt: tsToIso(data.created_at),
    };
  });

  const session: SessionViewModel = {
    id: name,
    name: (sessionData.name as string) ?? name,
    status: asSessionStatus(sessionData.status),
    previousStatus:
      typeof sessionData.previous_status === "string"
        ? asSessionStatus(sessionData.previous_status)
        : null,
    defaultBuyInCents:
      typeof sessionData.default_buy_in_cents === "number"
        ? sessionData.default_buy_in_cents
        : null,
    createdAt: tsToIso(sessionData.created_at),
    createdByName: (sessionData.created_by_name as string) ?? "Anonymous",
  };

  return (
    <SessionView
      session={session}
      players={players}
      payments={payments}
      log={log}
    />
  );
}
