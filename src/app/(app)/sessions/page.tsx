import { redirect } from "next/navigation";
import { ConnectionStatusLight } from "@/components/realtime/connection-status-light";
import { RealtimeSyncProvider } from "@/components/realtime/realtime-sync-provider";
import { StaleSyncBanner } from "@/components/realtime/stale-sync-banner";
import {
  DEFAULT_SESSION_FILTER,
  resolveSessionFilter,
} from "@/lib/sessions/filter";
import {
  fetchAllSessions,
  fetchNavCounts,
  fetchSessionsByStatus,
} from "@/lib/sessions/queries";
import type { SessionSummary } from "@/lib/sessions/types";
import { FilterPills } from "./filter-pills";
import { SessionList } from "./session-list";
import { SessionsHeader } from "./sessions-header";

type SerializableSession = Omit<SessionSummary, "createdAt"> & {
  createdAt: string;
};

function serialize(sessions: SessionSummary[]): SerializableSession[] {
  return sessions.map((s) => ({ ...s, createdAt: s.createdAt.toISOString() }));
}

const PAGE_SIZE = 10;

type Props = {
  searchParams: Promise<{ status?: string; page?: string }>;
};

export default async function SessionsPage({ searchParams }: Props) {
  const { status, page } = await searchParams;

  // Default the bare /sessions route to the live-game view. Redirecting (rather
  // than just rendering In Progress) keeps the URL, filter pills, and side-nav
  // highlight consistent. "All" is the explicit ?status=all escape hatch.
  if (status === undefined) {
    redirect(`/sessions?status=${DEFAULT_SESSION_FILTER}`);
  }

  const filter = resolveSessionFilter(status);

  const counts = await fetchNavCounts();

  const allSessions = filter
    ? await fetchSessionsByStatus(filter)
    : await fetchAllSessions();

  const totalCount = allSessions.length;
  const pageCount = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const currentPage = Math.min(
    Math.max(1, Number.parseInt(page ?? "1", 10) || 1),
    pageCount,
  );
  const pageSlice = allSessions.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );

  return (
    <RealtimeSyncProvider target="index">
      <div className="mx-auto flex max-w-3xl flex-col gap-6 p-4 md:p-6">
        <StaleSyncBanner />
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-semibold md:text-2xl">Sessions</h1>
          <ConnectionStatusLight />
        </div>
        <SessionsHeader />
        <FilterPills
          {...(filter !== undefined ? { activeFilter: filter } : {})}
          counts={counts}
        />
        <SessionList
          mode="filtered"
          {...(filter !== undefined ? { filter } : {})}
          sessions={serialize(pageSlice)}
          currentPage={currentPage}
          totalCount={totalCount}
          pageSize={PAGE_SIZE}
        />
      </div>
    </RealtimeSyncProvider>
  );
}
