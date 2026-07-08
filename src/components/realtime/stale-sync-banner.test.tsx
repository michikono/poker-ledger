import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ConnectionStatus } from "@/lib/realtime/connection-status";

const status = vi.hoisted(() => ({ value: "live" as ConnectionStatus }));
const reconnect = vi.hoisted(() => vi.fn());

vi.mock("./realtime-sync-provider", () => ({
  useRealtimeSync: () => ({ status: status.value, reconnect }),
}));

import { StaleSyncBanner } from "./stale-sync-banner";

const DELAY = 10_000;

function setVisibility(state: "visible" | "hidden") {
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    get: () => state,
  });
  document.dispatchEvent(new Event("visibilitychange"));
}

describe("StaleSyncBanner", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    setVisibility("visible");
    reconnect.mockClear();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders nothing when live", () => {
    status.value = "live";
    const { container } = render(<StaleSyncBanner />);
    expect(container).toBeEmptyDOMElement();
  });

  it("does not appear immediately when non-live, only after the delay", () => {
    status.value = "paused-idle";
    render(<StaleSyncBanner />);
    expect(screen.queryByTestId("stale-sync-banner")).not.toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(DELAY + 1);
    });
    expect(screen.getByTestId("stale-sync-banner")).toHaveTextContent(
      /paused after inactivity/i,
    );
  });

  it("never appears for a blip that recovers before the delay", () => {
    status.value = "offline";
    const { rerender } = render(<StaleSyncBanner />);
    act(() => {
      vi.advanceTimersByTime(DELAY / 2);
    });
    status.value = "live";
    rerender(<StaleSyncBanner />);
    act(() => {
      vi.advanceTimersByTime(DELAY);
    });
    expect(screen.queryByTestId("stale-sync-banner")).not.toBeInTheDocument();
  });

  it("stays hidden while the tab is hidden and restarts the delay on unlock", () => {
    // Non-live while hidden (phone locked) — must not arm.
    setVisibility("hidden");
    status.value = "offline";
    render(<StaleSyncBanner />);
    act(() => {
      vi.advanceTimersByTime(DELAY * 2);
    });
    expect(screen.queryByTestId("stale-sync-banner")).not.toBeInTheDocument();

    // Unlock: becomes visible, delay restarts from zero.
    act(() => {
      setVisibility("visible");
    });
    // Reconnect within the delay → banner never shows (the lock/unlock case).
    act(() => {
      vi.advanceTimersByTime(DELAY - 1);
    });
    expect(screen.queryByTestId("stale-sync-banner")).not.toBeInTheDocument();
  });

  it("shows a Refresh now action once visible", () => {
    status.value = "offline";
    render(<StaleSyncBanner />);
    act(() => {
      vi.advanceTimersByTime(DELAY + 1);
    });
    fireEvent.click(screen.getByTestId("stale-sync-refresh-now"));
    expect(reconnect).toHaveBeenCalled();
  });
});
