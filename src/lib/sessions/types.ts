export type SessionStatus = "in_progress" | "settling" | "settled" | "archived";

export type SessionSummary = {
  id: string;
  name: string;
  status: SessionStatus;
  createdAt: Date;
  playerCount: number;
};
