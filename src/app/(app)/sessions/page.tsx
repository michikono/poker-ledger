import {
  fetchAllSessions,
  fetchNavCounts,
  fetchSessionsByStatus,
} from "@/lib/sessions/queries";
import {
  isSessionStatus,
  type SessionStatus,
  type SessionSummary,
} from "@/lib/sessions/types";
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
  const filter: SessionStatus | undefined = isSessionStatus(status)
    ? status
    : undefined;

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
    <div className="mx-auto flex max-w-3xl flex-col gap-6 p-6">
      <h1 className="text-2xl font-semibold">Sessions</h1>
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
  );
}
