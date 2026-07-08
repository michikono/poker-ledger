import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ConnectionStatus } from "@/lib/realtime/connection-status";

const status = vi.hoisted(() => ({ value: "live" as ConnectionStatus }));

vi.mock("./realtime-sync-provider", () => ({
  useRealtimeStatus: () => status.value,
}));

import { ConnectionStatusLight } from "./connection-status-light";

describe("ConnectionStatusLight", () => {
  it("shows a pulsing green dot and a Live label when live", () => {
    status.value = "live";
    render(<ConnectionStatusLight />);
    const trigger = screen.getByTestId("connection-status-light");
    expect(trigger).toHaveAttribute(
      "aria-label",
      expect.stringContaining("Live"),
    );
    const dot = trigger.querySelector("span");
    expect(dot?.className).toContain("connection-pulse");
    expect(dot?.className).toContain("bg-emerald-500");
  });

  it("shows a static red dot when not live", () => {
    status.value = "paused-idle";
    render(<ConnectionStatusLight />);
    const dot = screen
      .getByTestId("connection-status-light")
      .querySelector("span");
    expect(dot?.className).toContain("bg-red-500");
    expect(dot?.className).not.toContain("connection-pulse");
  });

  it("opens a popover explaining the connection when tapped", async () => {
    status.value = "offline";
    render(<ConnectionStatusLight />);
    fireEvent.click(screen.getByTestId("connection-status-light"));
    await waitFor(() => {
      expect(
        screen.getByText(/resume automatically once you're back online/i),
      ).toBeInTheDocument();
    });
  });

  it("has a thumb-sized tap target", () => {
    status.value = "live";
    render(<ConnectionStatusLight />);
    expect(screen.getByTestId("connection-status-light").className).toContain(
      "size-11",
    );
  });
});
