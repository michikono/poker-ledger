import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  addBuyIn: vi.fn(),
  removeBuyIn: vi.fn(),
  setCashOut: vi.fn(),
  updatePlayer: vi.fn(),
  deletePlayer: vi.fn(),
  getClientAuth: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("./actions", () => ({
  addBuyIn: (...args: unknown[]) => mocks.addBuyIn(...args),
  removeBuyIn: (...args: unknown[]) => mocks.removeBuyIn(...args),
  setCashOut: (...args: unknown[]) => mocks.setCashOut(...args),
  updatePlayer: (...args: unknown[]) => mocks.updatePlayer(...args),
  deletePlayer: (...args: unknown[]) => mocks.deletePlayer(...args),
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

import { PlayerRow } from "./player-row";
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

function renderRow(
  player: SessionPlayerView,
  status: SessionStatus = "in_progress",
  defaultBuyInCents: number | null = null,
) {
  return render(
    <table>
      <tbody>
        <PlayerRow
          sessionId="s1"
          status={status}
          player={player}
          defaultBuyInCents={defaultBuyInCents}
          buyInHistory={[]}
        />
      </tbody>
    </table>,
  );
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

describe("PlayerRow — display only", () => {
  it("renders cash-out as text (no input on the row)", () => {
    renderRow(
      makePlayer({
        id: "p1",
        name: "Alice",
        cashOutCents: 7500,
      }),
    );

    expect(screen.getByTestId("cash-out-p1").textContent).toBe("$75.00");
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("renders buy-in pills as display-only", () => {
    renderRow(
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

  it("does not render an inline Add buy-in CTA on the row", () => {
    renderRow(makePlayer({ id: "p1", name: "Alice" }));

    expect(screen.queryByTestId("add-buy-in-cta-p1")).not.toBeInTheDocument();
  });
});

describe("PlayerRow — interaction", () => {
  it("opens the PlayerDetailsSheet when the row is clicked", () => {
    renderRow(makePlayer({ id: "p1", name: "Alice" }));

    fireEvent.click(screen.getByTestId("player-row-p1"));

    expect(screen.getByTestId("player-details-sheet-p1")).toBeInTheDocument();
  });

  it("opens the sheet on Enter keypress", () => {
    renderRow(makePlayer({ id: "p1", name: "Alice" }));

    fireEvent.keyDown(screen.getByTestId("player-row-p1"), { key: "Enter" });

    expect(screen.getByTestId("player-details-sheet-p1")).toBeInTheDocument();
  });

  it("closes the sheet from Cancel without the row's onClick re-opening it", () => {
    // Regression: the sheet renders through a React Portal, but React's
    // synthetic events still bubble along the component tree to the row's
    // onClick. The Cancel click bubbled up and re-opened the sheet, so the
    // user could never dismiss it (Cancel/backdrop appeared to do nothing).
    renderRow(makePlayer({ id: "p1", name: "Alice" }));

    fireEvent.click(screen.getByTestId("player-row-p1"));
    expect(screen.getByTestId("player-details-sheet-p1")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("pds-cancel-p1"));

    expect(
      screen.queryByTestId("player-details-sheet-p1"),
    ).not.toBeInTheDocument();
  });

  it("opens the sheet in read-only mode when archived", () => {
    renderRow(makePlayer({ id: "p1", name: "Alice" }), "archived");

    fireEvent.click(screen.getByTestId("player-row-p1"));

    expect(screen.getByTestId("player-details-sheet-p1")).toBeInTheDocument();
    // Archived sessions have no Save action.
    expect(screen.queryByTestId("pds-save-p1")).not.toBeInTheDocument();
  });

  it("shows the buy-in '+' only while in_progress", () => {
    const { unmount } = renderRow(makePlayer({ id: "p1", name: "Alice" }));
    expect(screen.getByTestId("pbi-open-p1")).toBeInTheDocument();
    unmount();

    renderRow(makePlayer({ id: "p1", name: "Alice" }), "settling");
    expect(screen.queryByTestId("pbi-open-p1")).not.toBeInTheDocument();
  });

  it("'+' opens the Buy-ins modal and does NOT open the edit sheet", () => {
    // The "+" lives inside the clickable <tr>; without stopPropagation its
    // click would also trigger the row's open-edit handler.
    renderRow(makePlayer({ id: "p1", name: "Alice" }));

    fireEvent.click(screen.getByTestId("pbi-open-p1"));

    expect(screen.getByTestId("buy-ins-modal-p1")).toBeInTheDocument();
    expect(
      screen.queryByTestId("player-details-sheet-p1"),
    ).not.toBeInTheDocument();
  });

  it("prefills the buy-in amount from the session default", () => {
    renderRow(makePlayer({ id: "p1", name: "Alice" }), "in_progress", 2500);

    fireEvent.click(screen.getByTestId("pbi-open-p1"));

    expect(
      (screen.getByTestId("pbi-amount-p1") as HTMLInputElement).value,
    ).toBe("25.00");
  });
});
