import { notFound } from "next/navigation";
import { StatusBadge } from "@/components/status-badge";
import { adminDb } from "@/lib/firebase/admin";
import type { SessionStatus } from "@/lib/sessions/types";

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

export default async function SessionPage({
  params,
}: {
  params: Promise<{ name: string }>;
}) {
  const { name } = await params;
  const doc = await adminDb.collection("sessions").doc(name).get();
  if (!doc.exists) notFound();
  const data = doc.data();
  const status = asSessionStatus(data?.status);
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{name}</h1>
        <StatusBadge status={status} />
      </div>
      <p className="text-muted-foreground">Session view coming soon.</p>
    </div>
  );
}
