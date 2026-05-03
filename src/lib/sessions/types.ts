export type SessionStatus = "in_progress" | "settling" | "settled" | "archived";

export type SessionSummary = {
  id: string;
  name: string;
  status: SessionStatus;
  createdAt: Date;
  playerCount: number;
};

const SESSION_STATUSES: readonly SessionStatus[] = [
  "in_progress",
  "settling",
  "settled",
  "archived",
];

export function isSessionStatus(value: unknown): value is SessionStatus {
  return SESSION_STATUSES.includes(value as SessionStatus);
}

export const STATUS_LABELS: Record<SessionStatus, string> = {
  in_progress: "In Progress",
  settling: "Settling",
  settled: "Settled",
  archived: "Archived",
};

export const STATUS_EMPTY_MESSAGES: Record<SessionStatus, string> = {
  in_progress: "No sessions in progress.",
  settling: "No sessions settling.",
  settled: "No settled sessions.",
  archived: "No archived sessions.",
};
