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

function renderSheet(
  player: SessionPlayerView = makePlayer({ id: "p1", name: "Alice" }),
  status: SessionStatus = "in_progress",
) {
  const onOpenChange = vi.fn();
  const utils = render(
    <PlayerDetailsSheet
      open
      onOpenChange={onOpenChange}
      sessionId="s1"
      status={status}
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

describe("PlayerDetailsSheet — no buy-in section (0022)", () => {
  // Buy-ins now live in their own BuyInsModal; the edit sheet must show no
  // buy-in UI in any status.
  it.each([
    "in_progress",
    "settling",
    "archived",
  ] as const)("renders no add field, list, or sum line when %s", (status) => {
    renderSheet(
      makePlayer({
        id: "p1",
        name: "Alice",
        buyIns: [
          { id: "b1", amountCents: 2500, createdAt: new Date().toISOString() },
        ],
      }),
      status,
    );

    expect(
      screen.queryByTestId("pds-add-buy-in-form-p1"),
    ).not.toBeInTheDocument();
    expect(screen.queryByTestId("pds-buy-in-b1")).not.toBeInTheDocument();
    expect(screen.queryByTestId("pds-buy-ins-sum-p1")).not.toBeInTheDocument();
  });

  it("orders the remaining fields: name → venmo → cash out → delete", () => {
    renderSheet(makePlayer({ id: "p1", name: "Alice" }));

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
    const cashOutLabel = labelIndex(/^Cash out$/);
    const deleteBtn = indexOf("pds-delete-p1");

    expect(nameLabel).toBeLessThan(venmoLabel);
    expect(venmoLabel).toBeLessThan(cashOutLabel);
    expect(cashOutLabel).toBeLessThan(deleteBtn);
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

describe("PlayerDetailsSheet — discard guard", () => {
  it("a clean form closes immediately without a discard prompt", () => {
    const { onOpenChange } = renderSheet();

    fireEvent.click(screen.getByTestId("pds-cancel-p1"));

    expect(
      screen.queryByTestId("pds-discard-confirm-p1"),
    ).not.toBeInTheDocument();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("Cancel on a dirty form prompts to discard instead of closing", () => {
    const { onOpenChange } = renderSheet();

    const nameInput = screen.getByLabelText(/name/i, {
      selector: "input",
    }) as HTMLInputElement;
    fireEvent.change(nameInput, { target: { value: "Alicia" } });

    fireEvent.click(screen.getByTestId("pds-cancel-p1"));

    // The sheet must NOT close — a confirmation appears first.
    expect(screen.getByTestId("pds-discard-confirm-p1")).toBeInTheDocument();
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("'Keep editing' dismisses the prompt and leaves the sheet open", () => {
    const { onOpenChange } = renderSheet();

    const nameInput = screen.getByLabelText(/name/i, {
      selector: "input",
    }) as HTMLInputElement;
    fireEvent.change(nameInput, { target: { value: "Alicia" } });
    fireEvent.click(screen.getByTestId("pds-cancel-p1"));

    fireEvent.click(screen.getByTestId("pds-discard-keep-p1"));

    expect(
      screen.queryByTestId("pds-discard-confirm-p1"),
    ).not.toBeInTheDocument();
    expect(onOpenChange).not.toHaveBeenCalled();
    // The edit is still there.
    expect(nameInput.value).toBe("Alicia");
  });

  it("'Discard' confirms and closes the sheet", () => {
    const { onOpenChange } = renderSheet();

    const nameInput = screen.getByLabelText(/name/i, {
      selector: "input",
    }) as HTMLInputElement;
    fireEvent.change(nameInput, { target: { value: "Alicia" } });
    fireEvent.click(screen.getByTestId("pds-cancel-p1"));

    fireEvent.click(screen.getByTestId("pds-discard-confirm-yes-p1"));

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(mocks.updatePlayer).not.toHaveBeenCalled();
    expect(mocks.setCashOut).not.toHaveBeenCalled();
  });
});

describe("PlayerDetailsSheet — settling mode", () => {
  function makeSettlingPlayer() {
    return makePlayer({
      id: "p1",
      name: "Alice",
      venmoUsername: null,
      cashOutCents: 5000,
      buyIns: [
        { id: "b1", amountCents: 2500, createdAt: new Date().toISOString() },
        { id: "b2", amountCents: 2500, createdAt: new Date().toISOString() },
      ],
    });
  }

  it("renders name as text and the cashout as text (no inputs)", () => {
    renderSheet(makeSettlingPlayer(), "settling");

    expect(screen.getByTestId("pds-name-text-p1").textContent).toBe("Alice");
    expect(screen.getByTestId("pds-cashout-text-p1").textContent).toBe(
      "$50.00",
    );
    // Cash-out hint explains why it isn't editable.
    expect(
      screen.getByText(/Cash-out is locked while the session is settling/),
    ).toBeInTheDocument();
  });

  it("renders the Venmo input as editable so the user can add a handle", () => {
    renderSheet(makeSettlingPlayer(), "settling");

    const venmoInput = screen.getByLabelText(/Venmo handle/i, {
      selector: "input",
    }) as HTMLInputElement;
    expect(venmoInput.disabled).toBe(false);
  });

  it("shows no buy-in section in settling (buy-ins live in their own modal)", () => {
    renderSheet(makeSettlingPlayer(), "settling");

    expect(screen.queryByTestId("pds-buy-ins-sum-p1")).not.toBeInTheDocument();
    expect(screen.queryByTestId("pds-buy-in-b1")).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("pds-add-buy-in-form-p1"),
    ).not.toBeInTheDocument();
  });

  it("hides the Delete player button in settling", () => {
    renderSheet(makeSettlingPlayer(), "settling");

    expect(screen.queryByTestId("pds-delete-p1")).not.toBeInTheDocument();
  });

  it("shows Save in the header (so the Venmo edit can be persisted)", () => {
    renderSheet(makeSettlingPlayer(), "settling");

    expect(screen.getByTestId("pds-save-p1")).toBeInTheDocument();
  });

  it("Save calls updatePlayer (NOT setCashOut) when only Venmo changes", async () => {
    mocks.updatePlayer.mockResolvedValueOnce({ success: true });
    renderSheet(makeSettlingPlayer(), "settling");

    const venmoInput = screen.getByLabelText(/Venmo handle/i, {
      selector: "input",
    }) as HTMLInputElement;
    fireEvent.change(venmoInput, { target: { value: "alice123" } });

    await act(async () => {
      fireEvent.click(screen.getByTestId("pds-save-p1"));
    });

    expect(mocks.updatePlayer).toHaveBeenCalledTimes(1);
    expect(mocks.updatePlayer).toHaveBeenCalledWith(
      {
        sessionId: "s1",
        playerId: "p1",
        name: "Alice",
        venmoUsername: "alice123",
      },
      "tok",
    );
    // Critical: cashout server action must NOT be called in settling mode.
    expect(mocks.setCashOut).not.toHaveBeenCalled();
  });

  it("Cancel/Close button is reachable and closes the sheet", () => {
    const { onOpenChange } = renderSheet(makeSettlingPlayer(), "settling");

    fireEvent.click(screen.getByRole("button", { name: /^cancel$/i }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("Cancel after an unsaved Venmo edit prompts to discard, then closes (settled mode)", () => {
    // Regression guard for the "I can't cancel out of the player details
    // screen sometimes, especially if the game is settled and I clicked on
    // a player to edit their Venmo" report. A dirty edit now routes Cancel
    // through a discard confirmation, but the user must still be able to get
    // out — Discard closes the sheet without persisting anything.
    const { onOpenChange } = renderSheet(makeSettlingPlayer(), "settled");

    const venmoInput = screen.getByLabelText(/Venmo handle/i, {
      selector: "input",
    }) as HTMLInputElement;
    fireEvent.change(venmoInput, { target: { value: "alice123" } });

    fireEvent.click(screen.getByTestId("pds-cancel-p1"));
    expect(screen.getByTestId("pds-discard-confirm-p1")).toBeInTheDocument();
    expect(onOpenChange).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId("pds-discard-confirm-yes-p1"));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(mocks.updatePlayer).not.toHaveBeenCalled();
  });

  it("Cancel still works when the previous Save attempt threw — settling Add-Venmo flow", async () => {
    // Regression guard for the "on the settling page when I click Add Venmo
    // for X, I can't always cancel out" report. Reproducer: the Save
    // attempt rejects (network blip, action throws). Without try/finally,
    // `saving` stayed true and the Cancel button stayed disabled, leaving
    // the user trapped in the sheet.
    mocks.updatePlayer.mockRejectedValueOnce(new Error("network down"));
    const { onOpenChange } = renderSheet(makeSettlingPlayer(), "settling");

    const venmoInput = screen.getByLabelText(/Venmo handle/i, {
      selector: "input",
    }) as HTMLInputElement;
    fireEvent.change(venmoInput, { target: { value: "alice123" } });

    await act(async () => {
      fireEvent.click(screen.getByTestId("pds-save-p1"));
    });

    const cancel = screen.getByTestId("pds-cancel-p1") as HTMLButtonElement;
    expect(cancel.disabled).toBe(false);

    // The venmo edit is still unsaved (the Save threw), so Cancel routes
    // through the discard prompt — but the user is not trapped: Discard closes.
    fireEvent.click(cancel);
    fireEvent.click(screen.getByTestId("pds-discard-confirm-yes-p1"));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("shows a generic error when Save throws so the user knows what happened", async () => {
    mocks.updatePlayer.mockRejectedValueOnce(new Error("network down"));
    renderSheet(makeSettlingPlayer(), "settling");

    const venmoInput = screen.getByLabelText(/Venmo handle/i, {
      selector: "input",
    }) as HTMLInputElement;
    fireEvent.change(venmoInput, { target: { value: "alice123" } });

    await act(async () => {
      fireEvent.click(screen.getByTestId("pds-save-p1"));
    });

    expect(screen.getByRole("alert").textContent).toMatch(/try again/i);
  });
});

describe("PlayerDetailsSheet — archived mode", () => {
  it("renders everything as text, no Save, with Close button", () => {
    const { onOpenChange } = renderSheet(
      makePlayer({
        id: "p1",
        name: "Alice",
        venmoUsername: "alice123",
        cashOutCents: 5000,
        buyIns: [
          { id: "b1", amountCents: 2500, createdAt: new Date().toISOString() },
        ],
      }),
      "archived",
    );

    expect(screen.getByTestId("pds-name-text-p1").textContent).toBe("Alice");
    expect(screen.getByTestId("pds-venmo-text-p1").textContent).toBe(
      "@alice123",
    );
    expect(screen.getByTestId("pds-cashout-text-p1").textContent).toBe(
      "$50.00",
    );
    expect(screen.queryByTestId("pds-save-p1")).not.toBeInTheDocument();
    expect(screen.queryByTestId("pds-delete-p1")).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^close$/i }));
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
