import type { SessionSummary } from "./types";

export function filterSessions(
  sessions: readonly SessionSummary[],
  query: string,
): SessionSummary[] {
  const trimmed = query.trim().toLowerCase();
  if (trimmed.length === 0) return sessions.slice();
  return sessions.filter((s) => s.name.toLowerCase().includes(trimmed));
}
