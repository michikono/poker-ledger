import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  addPlayer: vi.fn(),
  updateDefaultBuyIn: vi.fn(),
  setCashOut: vi.fn(),
  addBuyIn: vi.fn(),
  removeBuyIn: vi.fn(),
  updatePlayer: vi.fn(),
  deletePlayer: vi.fn(),
  getClientAuth: vi.fn(),
  getToken: vi.fn(),
  refresh: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("./actions", () => ({
  addPlayer: (...args: unknown[]) => mocks.addPlayer(...args),
  updateDefaultBuyIn: (...args: unknown[]) => mocks.updateDefaultBuyIn(...args),
  setCashOut: (...args: unknown[]) => mocks.setCashOut(...args),
  addBuyIn: (...args: unknown[]) => mocks.addBuyIn(...args),
  removeBuyIn: (...args: unknown[]) => mocks.removeBuyIn(...args),
  updatePlayer: (...args: unknown[]) => mocks.updatePlayer(...args),
  deletePlayer: (...args: unknown[]) => mocks.deletePlayer(...args),
}));

vi.mock("@/lib/firebase/client", () => ({
  getClientAuth: () => mocks.getClientAuth(),
}));

vi.mock("sonner", () => ({
  toast: { error: (msg: string) => mocks.toastError(msg) },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: () => mocks.refresh() }),
}));

import { PlayerList } from "./player-list";
import type { SessionPlayerView } from "./page";

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

function renderList(options: { players?: SessionPlayerView[] } = {}) {
  const players = options.players ?? [];
  return render(
    <PlayerList sessionId="s1" status="in_progress" players={players} />,
  );
}

describe("PlayerList — Add player form", () => {
  it("calls addPlayer when the form is submitted", async () => {
    mocks.addPlayer.mockResolvedValueOnce({
      success: true,
      data: { playerId: "p1" },
    });
    renderList();

    const input = screen.getByPlaceholderText(/Add player by name/);
    fireEvent.change(input, { target: { value: "Bob" } });

    await act(async () => {
      // Submit by clicking the Add player button.
      fireEvent.click(screen.getByRole("button", { name: /Add player/i }));
    });

    expect(mocks.addPlayer).toHaveBeenCalledTimes(1);
    expect(mocks.addPlayer).toHaveBeenCalledWith(
      { sessionId: "s1", name: "Bob" },
      "tok",
    );
  });

  it("shows a validation error and does not call addPlayer when the name is empty", async () => {
    renderList();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Add player/i }));
    });

    expect(mocks.addPlayer).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("renders Add player at the top before the player list", () => {
    renderList({
      players: [
        {
          id: "p1",
          name: "Alice",
          venmoUsername: null,
          cashOutCents: null,
          createdAt: new Date().toISOString(),
          buyIns: [],
        },
      ],
    });

    const form = screen.getByRole("form", { name: /Add player/i });
    const list = screen.getByTestId("player-card-list");
    // DOCUMENT_POSITION_FOLLOWING (4) means list comes after form.
    expect(
      form.compareDocumentPosition(list) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });
});
