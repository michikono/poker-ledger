import { isSessionStatus, type SessionStatus } from "@/lib/sessions/types";

export function tsToIso(value: unknown): string {
  if (value && typeof value === "object" && "toDate" in value) {
    const d = (value as { toDate: () => Date }).toDate();
    return d.toISOString();
  }
  if (value instanceof Date) return value.toISOString();
  return new Date(0).toISOString();
}

export function asSessionStatus(value: unknown): SessionStatus {
  return isSessionStatus(value) ? value : "in_progress";
}
