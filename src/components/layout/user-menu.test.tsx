import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  signOut: vi.fn(),
  firebaseSignOut: vi.fn(),
  authInstance: { __auth: true },
}));

vi.mock("@/app/sign-in/actions", () => ({
  signOut: (...args: unknown[]) => mocks.signOut(...args),
}));

vi.mock("firebase/auth", () => ({
  signOut: (...args: unknown[]) => mocks.firebaseSignOut(...args),
}));

vi.mock("@/lib/firebase/client", () => ({
  getClientAuth: () => mocks.authInstance,
}));

import { UserMenu } from "./user-menu";

describe("UserMenu", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.firebaseSignOut.mockResolvedValue(undefined);
    mocks.signOut.mockResolvedValue(undefined);
  });

  it("clears Firebase client auth state before invoking the signOut Server Action", async () => {
    const user = userEvent.setup();
    render(<UserMenu firstName="Jane" />);

    await user.click(screen.getByRole("button", { name: /log out/i }));

    expect(mocks.firebaseSignOut).toHaveBeenCalledWith(mocks.authInstance);
    expect(mocks.signOut).toHaveBeenCalledTimes(1);
    // Order: client signOut completes before the Server Action runs.
    expect(mocks.firebaseSignOut.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.signOut.mock.invocationCallOrder[0] ?? Number.POSITIVE_INFINITY,
    );
  });

  it("still invokes the signOut Server Action when client signOut throws", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    mocks.firebaseSignOut.mockRejectedValueOnce(new Error("indexeddb gone"));
    const user = userEvent.setup();
    render(<UserMenu firstName="Jane" />);

    await user.click(screen.getByRole("button", { name: /log out/i }));

    expect(mocks.signOut).toHaveBeenCalledTimes(1);
    consoleError.mockRestore();
  });
});
