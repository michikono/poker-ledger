import {
  fetchAllStatusGroups,
  fetchSessionsByStatus,
} from "@/lib/sessions/queries";
import {
  STATUS_LABELS,
  isSessionStatus,
  type SessionStatus,
  type SessionSummary,
} from "@/lib/sessions/types";
import { FilterPills } from "./filter-pills";
import { SessionList } from "./session-list";

type SerializableSession = Omit<SessionSummary, "createdAt"> & {
  createdAt: string;
};

function serialize(sessions: SessionSummary[]): SerializableSession[] {
  return sessions.map((s) => ({ ...s, createdAt: s.createdAt.toISOString() }));
}

const PAGE_SIZE = 10;

type Props = {
  searchParams: Promise<{ status?: string; page?: string; q?: string }>;
};

export default async function SessionsPage({ searchParams }: Props) {
  const { status, page, q } = await searchParams;
  const filter: SessionStatus | undefined = isSessionStatus(status)
    ? status
    : undefined;
  const query = typeof q === "string" ? q.trim() : "";

  if (filter) {
    const allSessions = await fetchSessionsByStatus(filter);
    const matched = query
      ? allSessions.filter((s) =>
          s.name.toLowerCase().includes(query.toLowerCase()),
        )
      : allSessions;
    const totalCount = matched.length;
    const pageCount = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
    const currentPage = Math.min(
      Math.max(1, Number.parseInt(page ?? "1", 10) || 1),
      pageCount,
    );
    const pageSlice = matched.slice(
      (currentPage - 1) * PAGE_SIZE,
      currentPage * PAGE_SIZE,
    );

    return (
      <div className="mx-auto flex max-w-3xl flex-col gap-6 p-6">
        <h1 className="text-2xl font-semibold">{STATUS_LABELS[filter]}</h1>
        <FilterPills activeFilter={filter} />
        <SessionList
          mode="filtered"
          filter={filter}
          sessions={serialize(pageSlice)}
          currentPage={currentPage}
          totalCount={totalCount}
          pageSize={PAGE_SIZE}
        />
      </div>
    );
  }

  const groups = await fetchAllStatusGroups();
  const filteredGroups = query
    ? (Object.fromEntries(
        (Object.keys(groups) as SessionStatus[]).map((s) => [
          s,
          groups[s].filter((session) =>
            session.name.toLowerCase().includes(query.toLowerCase()),
          ),
        ]),
      ) as Record<SessionStatus, SessionSummary[]>)
    : groups;

  const serializableGroups = Object.fromEntries(
    (Object.keys(filteredGroups) as SessionStatus[]).map((s) => [
      s,
      serialize(filteredGroups[s]),
    ]),
  ) as Record<SessionStatus, SerializableSession[]>;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 p-6">
      <h1 className="text-2xl font-semibold">Sessions</h1>
      <FilterPills />
      <SessionList
        mode="all"
        groups={serializableGroups}
        {...(query ? { initialQuery: query } : {})}
      />
    </div>
  );
}
