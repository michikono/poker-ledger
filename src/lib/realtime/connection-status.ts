export type ConnectionStatus = "live" | "paused-idle" | "offline";

export type ConnectionInputs = {
  // User has interacted within the idle window (from useActivityStatus).
  active: boolean;
  // The browser reports a network connection (navigator.onLine).
  online: boolean;
  // The realtime listener reported an error.
  errored: boolean;
};

// A stopped-because-idle client is reported as `paused-idle` regardless of
// network — the stop was intentional. Only an *active* client that has lost the
// network (or whose listener errored) is `offline`.
export function deriveConnectionStatus({
  active,
  online,
  errored,
}: ConnectionInputs): ConnectionStatus {
  if (!active) return "paused-idle";
  if (!online || errored) return "offline";
  return "live";
}

export function isLive(status: ConnectionStatus): boolean {
  return status === "live";
}

type ConnectionCopy = {
  // Accessible label / popover heading.
  label: string;
  // Short explanation shown in the tap popover.
  detail: string;
  // Banner text; absent when live (no banner shown).
  banner?: string;
};

export const CONNECTION_COPY: Record<ConnectionStatus, ConnectionCopy> = {
  live: {
    label: "Live",
    detail: "Live — this page updates automatically in the background.",
  },
  "paused-idle": {
    label: "Paused",
    detail:
      "Paused after a while of inactivity. Move, scroll, or tap the page to resume live updates.",
    banner:
      "Live updates paused after inactivity. Interact with the page to resume.",
  },
  offline: {
    label: "Offline",
    detail:
      "Connection lost. Live updates resume automatically once you're back online.",
    banner:
      "You're offline — this view isn't updating live. It'll resume when you reconnect.",
  },
};
