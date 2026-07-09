import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ConnectionStatus } from "@/lib/realtime/connection-status";

const status = vi.hoisted(() => ({ value: "live" as ConnectionStatus }));
const errorReason = vi.hoisted(() => ({ value: null as string | null }));
const reconnect = vi.hoisted(() => vi.fn());

vi.mock("./realtime-sync-provider", () => ({
  useRealtimeSync: () => ({
    status: status.value,
    reconnect,
    errorReason: errorReason.value,
  }),
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

  it("offers a Refresh now action in the popover when not live", async () => {
    status.value = "offline";
    reconnect.mockClear();
    render(<ConnectionStatusLight />);
    fireEvent.click(screen.getByTestId("connection-status-light"));
    const refresh = await screen.findByTestId("connection-refresh-now");
    fireEvent.click(refresh);
    expect(reconnect).toHaveBeenCalled();
  });

  it("does not offer Refresh now while live", async () => {
    status.value = "live";
    render(<ConnectionStatusLight />);
    fireEvent.click(screen.getByTestId("connection-status-light"));
    await waitFor(() => {
      expect(screen.getByText(/updates automatically/i)).toBeInTheDocument();
    });
    expect(
      screen.queryByTestId("connection-refresh-now"),
    ).not.toBeInTheDocument();
  });

  it("shows the listener error reason in the popover when offline from an error", async () => {
    status.value = "offline";
    errorReason.value = "permission-denied";
    render(<ConnectionStatusLight />);
    fireEvent.click(screen.getByTestId("connection-status-light"));
    const reason = await screen.findByTestId("connection-error-reason");
    expect(reason).toHaveTextContent("permission-denied");
    errorReason.value = null;
  });

  it("shows no error reason when there is none (e.g. paused-idle)", async () => {
    status.value = "paused-idle";
    errorReason.value = null;
    render(<ConnectionStatusLight />);
    fireEvent.click(screen.getByTestId("connection-status-light"));
    await screen.findByTestId("connection-refresh-now");
    expect(
      screen.queryByTestId("connection-error-reason"),
    ).not.toBeInTheDocument();
  });

  it("has a thumb-sized tap target", () => {
    status.value = "live";
    render(<ConnectionStatusLight />);
    expect(screen.getByTestId("connection-status-light").className).toContain(
      "size-11",
    );
  });
});
