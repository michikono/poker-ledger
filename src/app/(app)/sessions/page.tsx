import { fetchVisibleSessions } from "@/lib/sessions/queries";
import { SessionList } from "./session-list";

export default async function SessionsPage() {
  const sessions = await fetchVisibleSessions();
  const serializable = sessions.map((s) => ({
    ...s,
    createdAt: s.createdAt.toISOString(),
  }));

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 p-6">
      <h1 className="text-2xl font-semibold">Sessions</h1>
      <SessionList sessions={serializable} />
    </div>
  );
}
