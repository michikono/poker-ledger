import { act, fireEvent, render, screen, within } from "@testing-library/react";
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

import { PlayerDetailsSheet } from "./player-details-sheet";
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

function renderSheet(
  player: SessionPlayerView = makePlayer({ id: "p1", name: "Alice" }),
) {
  const onOpenChange = vi.fn();
  const utils = render(
    <PlayerDetailsSheet
      open
      onOpenChange={onOpenChange}
      sessionId="s1"
      status="in_progress"
      player={player}
    />,
  );
  return { ...utils, onOpenChange };
}

beforeEach(() => {
  mocks.addBuyIn.mockReset();
  mocks.removeBuyIn.mockReset();
  mocks.setCashOut.mockReset();
  mocks.updatePlayer.mockReset();
  mocks.deletePlayer.mockReset();
  mocks.refresh.mockReset();
  mocks.getClientAuth.mockReturnValue({
    authStateReady: () => Promise.resolve(),
    currentUser: { getIdToken: () => Promise.resolve("tok") },
  });
});

describe("PlayerDetailsSheet — inline Add buy-in", () => {
  it("calls addBuyIn (not updatePlayer/setCashOut) when the inline Add button is clicked", async () => {
    mocks.addBuyIn.mockResolvedValueOnce({
      success: true,
      data: { buyInId: "b1" },
    });
    renderSheet();

    const input = screen.getByTestId(
      "pds-add-buy-in-form-p1",
    ) as HTMLFormElement;
    const amount = input.querySelector("input") as HTMLInputElement;
    fireEvent.change(amount, { target: { value: "20" } });

    const addBtn = screen.getByTestId("pds-add-buy-in-submit-p1");
    await act(async () => {
      fireEvent.click(addBtn);
    });

    expect(mocks.addBuyIn).toHaveBeenCalledTimes(1);
    expect(mocks.addBuyIn).toHaveBeenCalledWith(
      { sessionId: "s1", playerId: "p1", amountCents: 2000 },
      "tok",
    );
    // Critical regression guard: clicking the inline Add button must NOT
    // accidentally trigger the outer save handler (which previously happened
    // because nested <form> elements get flattened by browsers).
    expect(mocks.updatePlayer).not.toHaveBeenCalled();
    expect(mocks.setCashOut).not.toHaveBeenCalled();
  });

  it("shows a validation error and does not submit when amount is empty", async () => {
    renderSheet();

    const addBtn = screen.getByTestId("pds-add-buy-in-submit-p1");
    await act(async () => {
      fireEvent.click(addBtn);
    });

    expect(mocks.addBuyIn).not.toHaveBeenCalled();
    expect(screen.getByText(/Enter an amount/)).toBeInTheDocument();
  });

  it("submits Add via Enter on the amount input without triggering the outer save", async () => {
    mocks.addBuyIn.mockResolvedValueOnce({
      success: true,
      data: { buyInId: "b1" },
    });
    renderSheet();

    const form = screen.getByTestId("pds-add-buy-in-form-p1");
    const amount = form.querySelector("input") as HTMLInputElement;
    fireEvent.change(amount, { target: { value: "15" } });
    await act(async () => {
      fireEvent.keyDown(amount, { key: "Enter" });
    });

    expect(mocks.addBuyIn).toHaveBeenCalledTimes(1);
    expect(mocks.addBuyIn).toHaveBeenCalledWith(
      { sessionId: "s1", playerId: "p1", amountCents: 1500 },
      "tok",
    );
    expect(mocks.updatePlayer).not.toHaveBeenCalled();
    expect(mocks.setCashOut).not.toHaveBeenCalled();
  });

  it("orders fields: name → venmo → add buy-in → buy-ins list → cash out → delete", () => {
    renderSheet(
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

    const sheet = screen.getByTestId("player-details-sheet-p1");
    const indexOf = (testId: string) => {
      const el = within(sheet).getByTestId(testId);
      return Array.from(sheet.querySelectorAll("*")).indexOf(el);
    };
    const labelIndex = (text: RegExp) => {
      const el = within(sheet).getByText(text);
      return Array.from(sheet.querySelectorAll("*")).indexOf(el);
    };

    const nameLabel = labelIndex(/^Name$/);
    const venmoLabel = labelIndex(/^Venmo handle$/);
    const addForm = indexOf("pds-add-buy-in-form-p1");
    const buyIn = indexOf("pds-buy-in-b1");
    const cashOutLabel = labelIndex(/^Cash out$/);
    const deleteBtn = indexOf("pds-delete-p1");

    expect(nameLabel).toBeLessThan(venmoLabel);
    expect(venmoLabel).toBeLessThan(addForm);
    expect(addForm).toBeLessThan(buyIn);
    expect(buyIn).toBeLessThan(cashOutLabel);
    expect(cashOutLabel).toBeLessThan(deleteBtn);
  });

  it("renders the Add a buy-in BEFORE the existing buy-ins list", () => {
    renderSheet(
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

    const addForm = screen.getByTestId("pds-add-buy-in-form-p1");
    const buyInRow = screen.getByTestId("pds-buy-in-b1");
    // DOCUMENT_POSITION_FOLLOWING (4) means buyInRow follows addForm in the
    // DOM. Asserting order so a future refactor can't quietly flip them back.
    expect(
      addForm.compareDocumentPosition(buyInRow) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("removes a buy-in via the row-level Remove button", async () => {
    mocks.removeBuyIn.mockResolvedValueOnce({ success: true });
    renderSheet(
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

    const remove = screen.getByTestId("pds-remove-buy-in-b1");
    await act(async () => {
      fireEvent.click(remove);
    });

    expect(mocks.removeBuyIn).toHaveBeenCalledTimes(1);
    expect(mocks.removeBuyIn).toHaveBeenCalledWith(
      { sessionId: "s1", playerId: "p1", buyInId: "b1" },
      "tok",
    );
  });
});

describe("PlayerDetailsSheet — Save", () => {
  it("calls updatePlayer when only the name changes", async () => {
    mocks.updatePlayer.mockResolvedValueOnce({ success: true });
    const { onOpenChange } = renderSheet();

    const nameInput = screen.getByLabelText(/name/i, {
      selector: "input",
    }) as HTMLInputElement;
    fireEvent.change(nameInput, { target: { value: "Alicia" } });

    await act(async () => {
      fireEvent.click(screen.getByTestId("pds-save-p1"));
    });

    expect(mocks.updatePlayer).toHaveBeenCalledTimes(1);
    expect(mocks.updatePlayer).toHaveBeenCalledWith(
      {
        sessionId: "s1",
        playerId: "p1",
        name: "Alicia",
        venmoUsername: null,
      },
      "tok",
    );
    expect(mocks.setCashOut).not.toHaveBeenCalled();
    expect(mocks.addBuyIn).not.toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("calls setCashOut when only the cash-out changes", async () => {
    mocks.setCashOut.mockResolvedValueOnce({ success: true });
    renderSheet();

    const cashOut = screen.getByLabelText(/^cash out$/i, {
      selector: "input",
    }) as HTMLInputElement;
    fireEvent.change(cashOut, { target: { value: "100" } });

    await act(async () => {
      fireEvent.click(screen.getByTestId("pds-save-p1"));
    });

    expect(mocks.setCashOut).toHaveBeenCalledTimes(1);
    expect(mocks.setCashOut).toHaveBeenCalledWith(
      { sessionId: "s1", playerId: "p1", amountCents: 10000 },
      "tok",
    );
    expect(mocks.updatePlayer).not.toHaveBeenCalled();
  });

  it("Save in the header is disabled until the form is dirty", () => {
    renderSheet();

    const save = screen.getByTestId("pds-save-p1") as HTMLButtonElement;
    expect(save.disabled).toBe(true);
  });

  it("Cancel in the header closes without calling any action", () => {
    const { onOpenChange } = renderSheet();

    fireEvent.click(screen.getByRole("button", { name: /^cancel$/i }));

    expect(mocks.updatePlayer).not.toHaveBeenCalled();
    expect(mocks.setCashOut).not.toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});

describe("PlayerDetailsSheet — Delete", () => {
  it("opens the confirm modal and calls deletePlayer on confirm", async () => {
    mocks.deletePlayer.mockResolvedValueOnce({ success: true });
    const { onOpenChange } = renderSheet();

    fireEvent.click(screen.getByTestId("pds-delete-p1"));
    expect(screen.getByTestId("pds-delete-confirm-p1")).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /^delete$/i }));
    });

    expect(mocks.deletePlayer).toHaveBeenCalledWith(
      { sessionId: "s1", playerId: "p1" },
      "tok",
    );
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
