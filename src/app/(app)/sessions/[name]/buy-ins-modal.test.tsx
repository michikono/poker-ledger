import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  addBuyIn: vi.fn(),
  removeBuyIn: vi.fn(),
  getClientAuth: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("./actions", () => ({
  addBuyIn: (...args: unknown[]) => mocks.addBuyIn(...args),
  removeBuyIn: (...args: unknown[]) => mocks.removeBuyIn(...args),
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

import { BuyInsModal } from "./buy-ins-modal";
import type { SessionPlayerView } from "./page";

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

function renderModal(
  player: SessionPlayerView = makePlayer({ id: "p1", name: "Alice" }),
  defaultBuyInCents: number | null = null,
) {
  const onOpenChange = vi.fn();
  const utils = render(
    <BuyInsModal
      open
      onOpenChange={onOpenChange}
      sessionId="s1"
      player={player}
      defaultBuyInCents={defaultBuyInCents}
    />,
  );
  return { ...utils, onOpenChange };
}

beforeEach(() => {
  mocks.addBuyIn.mockReset();
  mocks.removeBuyIn.mockReset();
  mocks.refresh.mockReset();
  mocks.getClientAuth.mockReturnValue({
    authStateReady: () => Promise.resolve(),
    currentUser: { getIdToken: () => Promise.resolve("tok") },
  });
});

describe("BuyInsModal — header", () => {
  it("titles the modal with the player's name and describes the action", () => {
    renderModal(makePlayer({ id: "p1", name: "Alice" }));

    // WHO: the title is the player's name.
    expect(screen.getByRole("heading", { name: "Alice" })).toBeInTheDocument();
    // ACTION: the description states what the user is about to do.
    expect(
      screen.getByText(/Add a buy-in to get started/i),
    ).toBeInTheDocument();
  });
});

describe("BuyInsModal — prefill", () => {
  it("prefills the amount from the session default", () => {
    renderModal(makePlayer({ id: "p1", name: "Alice" }), 2500);

    expect(
      (screen.getByTestId("pbi-amount-p1") as HTMLInputElement).value,
    ).toBe("25.00");
  });

  it("starts empty when there is no default", () => {
    renderModal(makePlayer({ id: "p1", name: "Alice" }), null);

    expect(
      (screen.getByTestId("pbi-amount-p1") as HTMLInputElement).value,
    ).toBe("");
  });
});

describe("BuyInsModal — add", () => {
  it("calls addBuyIn, stays open, and resets to the prefill", async () => {
    mocks.addBuyIn.mockResolvedValueOnce({
      success: true,
      data: { buyInId: "b9" },
    });
    const { onOpenChange } = renderModal(
      makePlayer({ id: "p1", name: "Alice" }),
      2500,
    );

    await act(async () => {
      fireEvent.click(screen.getByTestId("pbi-add-p1"));
    });

    expect(mocks.addBuyIn).toHaveBeenCalledWith(
      { sessionId: "s1", playerId: "p1", amountCents: 2500 },
      "tok",
    );
    // Stays open (no close), and the field returns to the prefill for rebuys.
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(
      (screen.getByTestId("pbi-amount-p1") as HTMLInputElement).value,
    ).toBe("25.00");
  });

  it("adds a custom typed amount", async () => {
    mocks.addBuyIn.mockResolvedValueOnce({
      success: true,
      data: { buyInId: "b9" },
    });
    renderModal(makePlayer({ id: "p1", name: "Alice" }), null);

    fireEvent.change(screen.getByTestId("pbi-amount-p1"), {
      target: { value: "40" },
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId("pbi-add-p1"));
    });

    expect(mocks.addBuyIn).toHaveBeenCalledWith(
      { sessionId: "s1", playerId: "p1", amountCents: 4000 },
      "tok",
    );
  });

  it("disables Add when the amount is empty", () => {
    renderModal(makePlayer({ id: "p1", name: "Alice" }), null);

    expect(
      (screen.getByTestId("pbi-add-p1") as HTMLButtonElement).disabled,
    ).toBe(true);
  });
});

describe("BuyInsModal — list + remove", () => {
  it("lists existing buy-ins and removes one", async () => {
    mocks.removeBuyIn.mockResolvedValueOnce({ success: true });
    renderModal(
      makePlayer({
        id: "p1",
        name: "Alice",
        buyIns: [
          { id: "b1", amountCents: 2500, createdAt: new Date().toISOString() },
        ],
      }),
    );

    expect(screen.getByTestId("pbi-row-b1")).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByTestId("pbi-remove-b1"));
    });

    expect(mocks.removeBuyIn).toHaveBeenCalledWith(
      { sessionId: "s1", playerId: "p1", buyInId: "b1" },
      "tok",
    );
  });
});

describe("BuyInsModal — discard guard", () => {
  it("closes without a prompt when the prefill is untouched", () => {
    const { onOpenChange } = renderModal(
      makePlayer({ id: "p1", name: "Alice" }),
      2500,
    );

    fireEvent.click(screen.getByTestId("pbi-close-p1"));

    expect(
      screen.queryByTestId("pbi-discard-confirm-p1"),
    ).not.toBeInTheDocument();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("prompts when the amount was changed from the prefill", () => {
    const { onOpenChange } = renderModal(
      makePlayer({ id: "p1", name: "Alice" }),
      2500,
    );

    fireEvent.change(screen.getByTestId("pbi-amount-p1"), {
      target: { value: "40" },
    });
    fireEvent.click(screen.getByTestId("pbi-close-p1"));

    expect(screen.getByTestId("pbi-discard-confirm-p1")).toBeInTheDocument();
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("Discard closes; Keep editing stays", () => {
    const { onOpenChange } = renderModal(
      makePlayer({ id: "p1", name: "Alice" }),
      null,
    );

    fireEvent.change(screen.getByTestId("pbi-amount-p1"), {
      target: { value: "40" },
    });

    // Keep editing.
    fireEvent.click(screen.getByTestId("pbi-close-p1"));
    fireEvent.click(screen.getByTestId("pbi-discard-keep-p1"));
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(
      (screen.getByTestId("pbi-amount-p1") as HTMLInputElement).value,
    ).toBe("40");

    // Discard.
    fireEvent.click(screen.getByTestId("pbi-close-p1"));
    fireEvent.click(screen.getByTestId("pbi-discard-confirm-yes-p1"));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
