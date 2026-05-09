import { fireEvent, render, screen } from "@testing-library/react";
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
  toast: { error: vi.fn(), success: vi.fn() },
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
  Object.values(mocks).forEach((fn) => {
    if (typeof (fn as { mockReset?: () => void }).mockReset === "function") {
      (fn as { mockReset: () => void }).mockReset();
    }
  });
  mocks.getClientAuth.mockReturnValue({
    authStateReady: () => Promise.resolve(),
    currentUser: { getIdToken: () => Promise.resolve("tok") },
  });
});

describe("PlayerCard — display only", () => {
  it("renders cash-out as formatted text (no input on the card)", () => {
    renderCard(
      makePlayer({
        id: "p1",
        name: "Alice",
        cashOutCents: 7500,
      }),
    );

    const cashOut = screen.getByTestId("cash-out-p1");
    expect(cashOut.tagName).toBe("DD");
    expect(cashOut.textContent).toBe("$75.00");
    // Critical: cash-out is no longer editable on the card itself.
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("renders cash-out as em-dash when null", () => {
    renderCard(makePlayer({ id: "p1", name: "Alice" }));

    expect(screen.getByTestId("cash-out-p1").textContent).toBe("—");
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

  it("does not render an Add buy-in CTA on the card (lives in the sheet)", () => {
    renderCard(makePlayer({ id: "p1", name: "Alice" }));

    expect(screen.queryByTestId("add-buy-in-cta-p1")).not.toBeInTheDocument();
  });

  it("does not render a More menu on the card", () => {
    renderCard(makePlayer({ id: "p1", name: "Alice" }));

    expect(screen.queryByTestId("player-card-more-p1")).not.toBeInTheDocument();
  });
});

describe("PlayerCard — interaction", () => {
  it("opens the PlayerDetailsSheet when the card is tapped", () => {
    renderCard(makePlayer({ id: "p1", name: "Alice" }));

    fireEvent.click(screen.getByTestId("player-card-name-p1"));

    expect(screen.getByTestId("player-details-sheet-p1")).toBeInTheDocument();
  });

  it("opens the sheet in read-only mode when archived (still tap-to-view)", () => {
    renderCard(makePlayer({ id: "p1", name: "Alice" }), "archived");

    fireEvent.click(screen.getByTestId("player-card-name-p1"));

    expect(screen.getByTestId("player-details-sheet-p1")).toBeInTheDocument();
    // Archived sessions show no Save action.
    expect(screen.queryByTestId("pds-save-p1")).not.toBeInTheDocument();
  });
});
