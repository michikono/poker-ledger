import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  setCashOut: vi.fn(),
  transitionToSettling: vi.fn(),
  updatePlayer: vi.fn(),
  getClientAuth: vi.fn(),
  toastError: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("./actions", () => ({
  setCashOut: (...args: unknown[]) => mocks.setCashOut(...args),
  transitionToSettling: (...args: unknown[]) =>
    mocks.transitionToSettling(...args),
  updatePlayer: (...args: unknown[]) => mocks.updatePlayer(...args),
}));

vi.mock("@/lib/firebase/client", () => ({
  getClientAuth: () => mocks.getClientAuth(),
}));

vi.mock("sonner", () => ({
  toast: {
    error: (msg: string) => mocks.toastError(msg),
    success: vi.fn(),
  },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: () => mocks.refresh() }),
}));

import { SettlingModal } from "./settling-modal";
import type { SessionPlayerView } from "./page";

function makePlayer(
  id: string,
  name: string,
  buyInCents: number,
  cashOutCents: number | null,
): SessionPlayerView {
  return {
    id,
    name,
    venmoUsername: null,
    cashOutCents,
    createdAt: new Date().toISOString(),
    buyIns:
      buyInCents > 0
        ? [
            {
              id: `${id}-b1`,
              amountCents: buyInCents,
              createdAt: new Date().toISOString(),
            },
          ]
        : [],
  };
}

beforeEach(() => {
  mocks.setCashOut.mockReset();
  mocks.transitionToSettling.mockReset();
  mocks.updatePlayer.mockReset();
  mocks.toastError.mockReset();
  mocks.refresh.mockReset();
  mocks.getClientAuth.mockReturnValue({
    authStateReady: () => Promise.resolve(),
    currentUser: { getIdToken: () => Promise.resolve("tok") },
  });
});

describe("SettlingModal", () => {
  it("disables Confirm when a player is missing a cash-out and shows the reason", () => {
    render(
      <SettlingModal
        open
        onOpenChange={() => {}}
        sessionId="s1"
        players={[
          makePlayer("p1", "Alice", 5000, 5000),
          makePlayer("p2", "Bob", 5000, null),
        ]}
      />,
    );

    const confirm = screen.getByTestId("settling-confirm") as HTMLButtonElement;
    expect(confirm.disabled).toBe(true);
    expect(screen.getByTestId("settling-error").textContent).toMatch(
      /Bob.*missing/,
    );
  });

  it("disables Confirm when shortfall exceeds 2%", () => {
    render(
      <SettlingModal
        open
        onOpenChange={() => {}}
        sessionId="s1"
        players={[makePlayer("p1", "Alice", 10000, 9000)]}
      />,
    );

    const confirm = screen.getByTestId("settling-confirm") as HTMLButtonElement;
    expect(confirm.disabled).toBe(true);
    expect(screen.getByTestId("settling-error").textContent).toMatch(
      /exceeds 2%/,
    );
  });

  it("disables Confirm when cash-outs exceed buy-ins", () => {
    render(
      <SettlingModal
        open
        onOpenChange={() => {}}
        sessionId="s1"
        players={[makePlayer("p1", "Alice", 5000, 7000)]}
      />,
    );

    const confirm = screen.getByTestId("settling-confirm") as HTMLButtonElement;
    expect(confirm.disabled).toBe(true);
    expect(screen.getByTestId("settling-error").textContent).toMatch(
      /exceed buy-ins/,
    );
  });

  it("enables Confirm when balanced and calls transitionToSettling", async () => {
    mocks.transitionToSettling.mockResolvedValueOnce({
      success: true,
      data: { finalStatus: "settling", payments: [] },
    });
    render(
      <SettlingModal
        open
        onOpenChange={() => {}}
        sessionId="s1"
        players={[
          makePlayer("p1", "Alice", 5000, 5000),
          makePlayer("p2", "Bob", 5000, 5000),
        ]}
      />,
    );

    const confirm = screen.getByTestId("settling-confirm") as HTMLButtonElement;
    expect(confirm.disabled).toBe(false);
    await act(async () => {
      fireEvent.click(confirm);
    });
    expect(mocks.transitionToSettling).toHaveBeenCalledTimes(1);
  });

  it("persists changed cash-out drafts before transitioning", async () => {
    mocks.setCashOut.mockResolvedValueOnce({ success: true });
    mocks.transitionToSettling.mockResolvedValueOnce({
      success: true,
      data: { finalStatus: "settling", payments: [] },
    });
    render(
      <SettlingModal
        open
        onOpenChange={() => {}}
        sessionId="s1"
        players={[makePlayer("p1", "Alice", 10000, 5000)]}
      />,
    );

    // Change Alice's cash-out from 50.00 to 100.00
    const input = screen.getByTestId("settling-cashout-p1") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "100.00" } });

    await act(async () => {
      fireEvent.click(screen.getByTestId("settling-confirm"));
    });

    expect(mocks.setCashOut).toHaveBeenCalledWith(
      { sessionId: "s1", playerId: "p1", amountCents: 10000 },
      "tok",
    );
    expect(mocks.transitionToSettling).toHaveBeenCalledTimes(1);
  });

  it("persists Venmo handle changes via updatePlayer before transitioning", async () => {
    mocks.updatePlayer.mockResolvedValueOnce({ success: true });
    mocks.transitionToSettling.mockResolvedValueOnce({
      success: true,
      data: { finalStatus: "settling", payments: [] },
    });
    render(
      <SettlingModal
        open
        onOpenChange={() => {}}
        sessionId="s1"
        players={[makePlayer("p1", "Alice", 5000, 5000)]}
      />,
    );

    const venmoInput = screen.getByTestId(
      "settling-venmo-p1",
    ) as HTMLInputElement;
    fireEvent.change(venmoInput, { target: { value: "alice123" } });

    await act(async () => {
      fireEvent.click(screen.getByTestId("settling-confirm"));
    });

    expect(mocks.updatePlayer).toHaveBeenCalledWith(
      {
        sessionId: "s1",
        playerId: "p1",
        name: "Alice",
        venmoUsername: "alice123",
      },
      "tok",
    );
    expect(mocks.transitionToSettling).toHaveBeenCalledTimes(1);
  });

  it("blocks confirm and shows an inline error when a Venmo handle is invalid", async () => {
    render(
      <SettlingModal
        open
        onOpenChange={() => {}}
        sessionId="s1"
        players={[makePlayer("p1", "Alice", 5000, 5000)]}
      />,
    );

    const venmoInput = screen.getByTestId(
      "settling-venmo-p1",
    ) as HTMLInputElement;
    fireEvent.change(venmoInput, { target: { value: "no spaces" } });

    await act(async () => {
      fireEvent.click(screen.getByTestId("settling-confirm"));
    });

    expect(mocks.updatePlayer).not.toHaveBeenCalled();
    expect(mocks.transitionToSettling).not.toHaveBeenCalled();
    // Both the mobile-card and md+ table layouts render in jsdom (CSS media
    // queries aren't evaluated), so the validation message appears in each.
    expect(screen.getAllByText(/5–30 characters/).length).toBeGreaterThan(0);
  });
});
