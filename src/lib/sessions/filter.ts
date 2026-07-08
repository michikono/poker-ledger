import { isSessionStatus, type SessionStatus } from "./types";

// The sessions index defaults to the live-game view. A missing or unrecognized
// `status` param resolves to In Progress; "all" is the explicit escape hatch
// that shows every session (returned here as `undefined` = no filter).
export const DEFAULT_SESSION_FILTER: SessionStatus = "in_progress";

export function resolveSessionFilter(
  statusParam: string | undefined,
): SessionStatus | undefined {
  if (statusParam === "all") return undefined;
  if (isSessionStatus(statusParam)) return statusParam;
  return DEFAULT_SESSION_FILTER;
}
