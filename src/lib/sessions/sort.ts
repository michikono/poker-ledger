import type { SessionStatus, SessionSummary } from "./types";

const STATUS_PRIORITY: Record<SessionStatus, number> = {
  in_progress: 0,
  settling: 1,
  settled: 2,
  archived: 3,
};

export function sortSessions(
  sessions: readonly SessionSummary[],
): SessionSummary[] {
  return sessions
    .filter((s) => s.status !== "archived")
    .slice()
    .sort((a, b) => {
      const priorityDiff =
        STATUS_PRIORITY[a.status] - STATUS_PRIORITY[b.status];
      if (priorityDiff !== 0) return priorityDiff;
      return b.createdAt.getTime() - a.createdAt.getTime();
    });
}
