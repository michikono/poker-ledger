import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
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
  toast: { error: vi.fn() },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: () => mocks.refresh() }),
}));

import { PlayerRow, type PlayerRowHandle } from "./player-row";
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

function renderRow(player: SessionPlayerView) {
  return render(
    <table>
      <tbody>
        <PlayerRow sessionId="s1" status="in_progress" player={player} />
      </tbody>
    </table>,
  );
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

describe("PlayerRow — edit form", () => {
  it("opens the edit form with name and Venmo handle when the player name is clicked", () => {
    renderRow(
      makePlayer({ id: "p1", name: "Alice", venmoUsername: "alice123" }),
    );

    fireEvent.click(screen.getByText("Alice"));

    expect(screen.getByLabelText("Name")).toHaveValue("Alice");
    expect(screen.getByLabelText("Venmo handle (optional)")).toHaveValue(
      "alice123",
    );
    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Delete player" }),
    ).toBeInTheDocument();
  });

  it("Delete player opens a confirmation dialog rather than deleting immediately", () => {
    renderRow(makePlayer({ id: "p1", name: "Alice" }));

    fireEvent.click(screen.getByText("Alice"));
    fireEvent.click(screen.getByRole("button", { name: "Delete player" }));

    expect(screen.getByTestId("delete-player-dialog-p1")).toBeInTheDocument();
    expect(screen.getByText("Delete player?")).toBeInTheDocument();
    expect(mocks.deletePlayer).not.toHaveBeenCalled();
  });

  it("Cancel in the confirm dialog closes it without calling deletePlayer", () => {
    renderRow(makePlayer({ id: "p1", name: "Alice" }));

    fireEvent.click(screen.getByText("Alice"));
    fireEvent.click(screen.getByRole("button", { name: "Delete player" }));

    const dialog = screen.getByTestId("delete-player-dialog-p1");
    const cancelBtn = Array.from(dialog.querySelectorAll("button")).find(
      (b) => b.textContent === "Cancel",
    );
    expect(cancelBtn).toBeDefined();
    fireEvent.click(cancelBtn as HTMLElement);
    expect(mocks.deletePlayer).not.toHaveBeenCalled();
  });

  it("Confirming the dialog actually calls deletePlayer", async () => {
    mocks.deletePlayer.mockResolvedValue({ success: true, data: undefined });

    renderRow(makePlayer({ id: "p1", name: "Alice" }));

    fireEvent.click(screen.getByText("Alice"));
    fireEvent.click(screen.getByRole("button", { name: "Delete player" }));

    const dialog = screen.getByTestId("delete-player-dialog-p1");
    const deleteBtn = Array.from(dialog.querySelectorAll("button")).find(
      (b) => b.textContent === "Delete",
    );
    expect(deleteBtn).toBeDefined();
    fireEvent.click(deleteBtn as HTMLElement);

    await waitFor(() => expect(mocks.deletePlayer).toHaveBeenCalledTimes(1));
    expect(mocks.deletePlayer).toHaveBeenCalledWith(
      { sessionId: "s1", playerId: "p1" },
      "tok",
    );
  });
});

describe("PlayerRow — buy-in column", () => {
  it("renders the Add buy-in CTA but no form by default", () => {
    renderRow(makePlayer({ id: "p1", name: "Alice" }));

    expect(screen.getByTestId("add-buy-in-cta-p1")).toBeInTheDocument();
    expect(
      screen.queryByLabelText("Add buy-in for Alice"),
    ).not.toBeInTheDocument();
  });

  it("clicking the CTA expands the inline buy-in form", () => {
    renderRow(makePlayer({ id: "p1", name: "Alice" }));

    fireEvent.click(screen.getByTestId("add-buy-in-cta-p1"));

    expect(screen.getByLabelText("Add buy-in for Alice")).toBeInTheDocument();
    expect(screen.queryByTestId("add-buy-in-cta-p1")).not.toBeInTheDocument();
  });

  it("Cancel collapses the form back to the CTA", () => {
    renderRow(makePlayer({ id: "p1", name: "Alice" }));

    fireEvent.click(screen.getByTestId("add-buy-in-cta-p1"));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.getByTestId("add-buy-in-cta-p1")).toBeInTheDocument();
  });
});

describe("PlayerRow — imperative handle", () => {
  it("calling openEdit() on the ref opens the edit form", () => {
    const handle = { current: null as PlayerRowHandle | null };
    render(
      <table>
        <tbody>
          <PlayerRow
            sessionId="s1"
            status="in_progress"
            player={makePlayer({
              id: "p1",
              name: "Alice",
              venmoUsername: "alice123",
            })}
            ref={(h) => {
              handle.current = h;
            }}
          />
        </tbody>
      </table>,
    );

    // No edit form yet
    expect(screen.queryByLabelText("Name")).not.toBeInTheDocument();

    act(() => {
      handle.current?.openEdit();
    });

    // Edit form appeared with name and existing handle
    expect(screen.getByLabelText("Name")).toHaveValue("Alice");
    expect(screen.getByLabelText("Venmo handle (optional)")).toHaveValue(
      "alice123",
    );
  });

  it("openEdit() is a no-op for archived sessions", () => {
    const handle = { current: null as PlayerRowHandle | null };
    render(
      <table>
        <tbody>
          <PlayerRow
            sessionId="s1"
            status="archived"
            player={makePlayer({ id: "p1", name: "Alice" })}
            ref={(h) => {
              handle.current = h;
            }}
          />
        </tbody>
      </table>,
    );

    act(() => {
      handle.current?.openEdit();
    });

    expect(screen.queryByLabelText("Name")).not.toBeInTheDocument();
  });

  it("openEdit({ focus: 'venmo' }) focuses the Venmo handle field", async () => {
    const handle = { current: null as PlayerRowHandle | null };
    render(
      <table>
        <tbody>
          <PlayerRow
            sessionId="s1"
            status="in_progress"
            player={makePlayer({ id: "p1", name: "Alice" })}
            ref={(h) => {
              handle.current = h;
            }}
          />
        </tbody>
      </table>,
    );

    act(() => {
      handle.current?.openEdit({ focus: "venmo" });
    });

    await waitFor(() => {
      expect(screen.getByLabelText("Venmo handle (optional)")).toHaveFocus();
    });
  });
});

describe("PlayerRow — name validation", () => {
  it("rejects a punctuation-only name with 'letter or emoji' message", async () => {
    renderRow(makePlayer({ id: "p1", name: "Alice" }));

    fireEvent.click(screen.getByText("Alice"));
    const nameInput = screen.getByLabelText("Name");
    fireEvent.change(nameInput, { target: { value: "." } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(screen.getByText(/letter or emoji/i)).toBeInTheDocument();
    });
    expect(mocks.updatePlayer).not.toHaveBeenCalled();
  });
});

describe("PlayerRow — collapsed-state affordances", () => {
  it("shows a Venmo icon next to the name when the player has a handle", () => {
    renderRow(
      makePlayer({ id: "p1", name: "Alice", venmoUsername: "alice123" }),
    );
    expect(screen.getByLabelText("Venmo: @alice123")).toBeInTheDocument();
  });

  it("does not show the Venmo icon when no handle is set", () => {
    renderRow(makePlayer({ id: "p1", name: "Alice" }));
    expect(screen.queryByLabelText(/Venmo:/)).not.toBeInTheDocument();
  });
});
