import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ConnectionStatus } from "@/lib/realtime/connection-status";

const status = vi.hoisted(() => ({ value: "live" as ConnectionStatus }));

vi.mock("./realtime-sync-provider", () => ({
  useRealtimeStatus: () => status.value,
}));

import { StaleSyncBanner } from "./stale-sync-banner";

describe("StaleSyncBanner", () => {
  it("renders nothing when live", () => {
    status.value = "live";
    const { container } = render(<StaleSyncBanner />);
    expect(container).toBeEmptyDOMElement();
  });

  it("warns about paused updates when idle", () => {
    status.value = "paused-idle";
    render(<StaleSyncBanner />);
    expect(screen.getByTestId("stale-sync-banner")).toHaveTextContent(
      /paused after inactivity/i,
    );
  });

  it("warns about being offline", () => {
    status.value = "offline";
    render(<StaleSyncBanner />);
    expect(screen.getByTestId("stale-sync-banner")).toHaveTextContent(
      /offline/i,
    );
  });
});
