import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  addBuyIn: vi.fn(),
  removeBuyIn: vi.fn(),
  setCashOut: vi.fn(),
  updatePlayer: vi.fn(),
  deletePlayer: vi.fn(),
  updateDefaultBuyIn: vi.fn(),
  getClientAuth: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("./actions", () => ({
  addBuyIn: (...args: unknown[]) => mocks.addBuyIn(...args),
  removeBuyIn: (...args: unknown[]) => mocks.removeBuyIn(...args),
  setCashOut: (...args: unknown[]) => mocks.setCashOut(...args),
  updatePlayer: (...args: unknown[]) => mocks.updatePlayer(...args),
  deletePlayer: (...args: unknown[]) => mocks.deletePlayer(...args),
  updateDefaultBuyIn: (...args: unknown[]) => mocks.updateDefaultBuyIn(...args),
}));

vi.mock("@/lib/firebase/client", () => ({
  getClientAuth: () => mocks.getClientAuth(),
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn() },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: () => mocks.refresh() }),
}));

import { PlayerCard } from "./player-card";
import type { SessionPlayerView } from "./page";
import type { SessionStatus } from "@/lib/sessions/types";

function makePlayer(
  partial: Partial<SessionPlayerView> & Pick<SessionPlayerView, "id" | "name">,
): SessionPlayerView {
  return {
    venmoUsername: null,
    cashOutCents: null,
    createdAt: new Date().toISOString(),
    buyIns: [],
    ...partial,
  };
}

function renderCard(
  player: SessionPlayerView,
  status: SessionStatus = "in_progress",
) {
  return render(<PlayerCard sessionId="s1" status={status} player={player} />);
}

beforeEach(() => {
  mocks.addBuyIn.mockReset();
  mocks.removeBuyIn.mockReset();
  mocks.setCashOut.mockReset();
  mocks.updatePlayer.mockReset();
  mocks.deletePlayer.mockReset();
  mocks.updateDefaultBuyIn.mockReset();
  mocks.refresh.mockReset();
  mocks.getClientAuth.mockReturnValue({
    authStateReady: () => Promise.resolve(),
    currentUser: { getIdToken: () => Promise.resolve("tok") },
  });
});

describe("PlayerCard — read-only states", () => {
  it("renders cash-out as plain text and hides the More menu when archived", () => {
    renderCard(
      makePlayer({
        id: "p1",
        name: "Alice",
        cashOutCents: 7500,
        buyIns: [
          {
            id: "b1",
            amountCents: 5000,
            createdAt: new Date().toISOString(),
          },
        ],
      }),
      "archived",
    );

    expect(screen.queryByTestId("cash-out-p1")).not.toBeInTheDocument();
    expect(screen.queryByTestId("player-card-more-p1")).not.toBeInTheDocument();
    expect(screen.queryByTestId("add-buy-in-cta-p1")).not.toBeInTheDocument();
    // Cash-out value rendered as plain text.
    expect(screen.getByText("$75.00")).toBeInTheDocument();
  });

  it("hides the inline cash-out input and Add buy-in CTA when settling", () => {
    renderCard(
      makePlayer({
        id: "p1",
        name: "Alice",
        cashOutCents: 5000,
      }),
      "settling",
    );

    expect(screen.queryByTestId("cash-out-p1")).not.toBeInTheDocument();
    expect(screen.queryByTestId("add-buy-in-cta-p1")).not.toBeInTheDocument();
  });

  it("renders buy-in pills as display-only (no per-pill remove)", () => {
    renderCard(
      makePlayer({
        id: "p1",
        name: "Alice",
        buyIns: [
          {
            id: "b1",
            amountCents: 2500,
            createdAt: new Date().toISOString(),
          },
        ],
      }),
    );

    expect(screen.getByTestId("buy-in-b1")).toBeInTheDocument();
    expect(
      screen.queryByLabelText(/Remove \$25\.00 buy-in/),
    ).not.toBeInTheDocument();
  });
});

describe("PlayerCard — editable in_progress", () => {
  it("commits cash-out on blur via setCashOut", async () => {
    mocks.setCashOut.mockResolvedValueOnce({ success: true });
    renderCard(makePlayer({ id: "p1", name: "Alice", cashOutCents: null }));

    const input = screen.getByTestId("cash-out-p1") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "75" } });
    await act(async () => {
      fireEvent.blur(input);
    });

    expect(mocks.setCashOut).toHaveBeenCalledWith(
      { sessionId: "s1", playerId: "p1", amountCents: 7500 },
      "tok",
    );
  });

  it("opens the AddBuyInModal when the primary Add buy-in CTA is tapped", () => {
    renderCard(makePlayer({ id: "p1", name: "Alice" }));

    fireEvent.click(screen.getByTestId("add-buy-in-cta-p1"));

    expect(screen.getByTestId("add-buy-in-modal-p1")).toBeInTheDocument();
  });

  it("opens the PlayerDetailsSheet when the player name row is tapped", () => {
    renderCard(makePlayer({ id: "p1", name: "Alice" }));

    fireEvent.click(screen.getByTestId("player-card-name-p1"));

    expect(screen.getByTestId("player-details-sheet-p1")).toBeInTheDocument();
  });
});
