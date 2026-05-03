import type { SessionStatus } from "./types";

export type TransitionContext = {
  from: SessionStatus;
  to: SessionStatus;
  previousStatus?: SessionStatus | null;
};

export type TransitionResult =
  | { ok: true }
  | { ok: false; code: "INVALID_STATE_TRANSITION" };

const ALLOWED: ReadonlyArray<readonly [SessionStatus, SessionStatus]> = [
  ["in_progress", "settling"],
  ["in_progress", "settled"],
  ["in_progress", "archived"],
  ["settling", "in_progress"],
  ["settling", "settled"],
  ["settling", "archived"],
  ["settled", "settling"],
  ["settled", "archived"],
];

const RECOVERABLE_STATUSES = [
  "in_progress",
  "settling",
  "settled",
] as const satisfies readonly SessionStatus[];

type RecoverableStatus = (typeof RECOVERABLE_STATUSES)[number];

function isRecoverableStatus(
  status: SessionStatus | null | undefined,
): status is RecoverableStatus {
  return (
    status !== null &&
    status !== undefined &&
    (RECOVERABLE_STATUSES as readonly SessionStatus[]).includes(status)
  );
}

const DENIED: TransitionResult = {
  ok: false,
  code: "INVALID_STATE_TRANSITION",
};

export function validateTransition(ctx: TransitionContext): TransitionResult {
  const { from, to, previousStatus } = ctx;

  if (from === "archived") {
    if (!isRecoverableStatus(previousStatus)) return DENIED;
    return to === previousStatus ? { ok: true } : DENIED;
  }

  if (from === to) return DENIED;
  const isAllowed = ALLOWED.some(([f, t]) => f === from && t === to);
  return isAllowed ? { ok: true } : DENIED;
}

export function getValidTransitions(
  from: SessionStatus,
  previousStatus?: SessionStatus | null,
): SessionStatus[] {
  if (from === "archived") {
    return isRecoverableStatus(previousStatus) ? [previousStatus] : [];
  }
  return ALLOWED.filter(([f]) => f === from).map(([, t]) => t);
}
