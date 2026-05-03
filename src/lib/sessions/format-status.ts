import type { SessionStatus } from "./types";

export function formatStatus(status: SessionStatus): string {
  switch (status) {
    case "in_progress":
      return "In progress";
    case "settling":
      return "Settling";
    case "settled":
      return "Settled";
    case "archived":
      return "Archived";
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}
