import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

const createSession = vi.fn();
vi.mock("./actions", () => ({
  createSession: (...args: unknown[]) => createSession(...args),
}));

const getIdToken = vi.fn();
const authStateReady = vi.fn(async () => {});
vi.mock("@/lib/firebase/client", () => ({
  getClientAuth: () => ({
    currentUser: { getIdToken },
    authStateReady,
  }),
}));

const toastError = vi.fn();
vi.mock("sonner", () => ({
  toast: { error: (...args: unknown[]) => toastError(...args) },
}));

import { CreateSessionDialog } from "./create-session-dialog";

beforeEach(() => {
  push.mockReset();
  createSession.mockReset();
  getIdToken.mockReset();
  toastError.mockReset();
  getIdToken.mockResolvedValue("tok");
});

describe("CreateSessionDialog", () => {
  it("opens the dialog when the trigger is clicked", async () => {
    const user = userEvent.setup();
    render(<CreateSessionDialog />);
    expect(screen.queryByRole("heading", { name: "New session" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "New session" }));
    expect(
      screen.getByRole("heading", { name: "New session" }),
    ).toBeInTheDocument();
  });

  it("shows inline error when default buy-in cannot be parsed", async () => {
    const user = userEvent.setup();
    render(<CreateSessionDialog />);
    await user.click(screen.getByRole("button", { name: "New session" }));
    await user.type(screen.getByLabelText(/Default buy-in/), "abc");
    await user.click(screen.getByRole("button", { name: "Create" }));
    expect(
      screen.getByText("Enter a valid amount, e.g., 25 or 25.00."),
    ).toBeInTheDocument();
    expect(createSession).not.toHaveBeenCalled();
  });

  it("invokes createSession with undefined defaultBuyInCents when the field is empty", async () => {
    const user = userEvent.setup();
    createSession.mockResolvedValueOnce({
      success: true,
      data: { sessionId: "apple-bacon-001" },
    });
    render(<CreateSessionDialog />);
    await user.click(screen.getByRole("button", { name: "New session" }));
    await user.click(screen.getByRole("button", { name: "Create" }));
    await waitFor(() => expect(createSession).toHaveBeenCalledTimes(1));
    expect(createSession).toHaveBeenCalledWith({}, "tok");
    await waitFor(() =>
      expect(push).toHaveBeenCalledWith("/sessions/apple-bacon-001"),
    );
  });

  it("redirects on successful creation with a parsed amount", async () => {
    const user = userEvent.setup();
    createSession.mockResolvedValueOnce({
      success: true,
      data: { sessionId: "cherry-date-002" },
    });
    render(<CreateSessionDialog />);
    await user.click(screen.getByRole("button", { name: "New session" }));
    await user.type(screen.getByLabelText(/Default buy-in/), "25.50");
    await user.click(screen.getByRole("button", { name: "Create" }));
    await waitFor(() => expect(createSession).toHaveBeenCalledTimes(1));
    expect(createSession).toHaveBeenCalledWith(
      { defaultBuyInCents: 2550 },
      "tok",
    );
    await waitFor(() =>
      expect(push).toHaveBeenCalledWith("/sessions/cherry-date-002"),
    );
  });

  it("disables the submit button while the request is in flight", async () => {
    const user = userEvent.setup();
    let resolve: (v: { success: true; data: { sessionId: string } }) => void =
      () => {};
    createSession.mockReturnValueOnce(
      new Promise((r) => {
        resolve = r;
      }),
    );
    render(<CreateSessionDialog />);
    await user.click(screen.getByRole("button", { name: "New session" }));
    await user.click(screen.getByRole("button", { name: "Create" }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Creating…" })).toBeDisabled(),
    );
    resolve({ success: true, data: { sessionId: "apple-bacon-001" } });
    await waitFor(() =>
      expect(push).toHaveBeenCalledWith("/sessions/apple-bacon-001"),
    );
  });

  it("shows an inline amount error when server returns INVALID_AMOUNT", async () => {
    const user = userEvent.setup();
    createSession.mockResolvedValueOnce({
      success: false,
      error: { code: "INVALID_AMOUNT", message: "x" },
    });
    render(<CreateSessionDialog />);
    await user.click(screen.getByRole("button", { name: "New session" }));
    await user.type(screen.getByLabelText(/Default buy-in/), "25");
    await user.click(screen.getByRole("button", { name: "Create" }));
    await waitFor(() =>
      expect(
        screen.getByText("Enter a valid amount, e.g., 25 or 25.00."),
      ).toBeInTheDocument(),
    );
    expect(push).not.toHaveBeenCalled();
    // dialog still open
    expect(
      screen.getByRole("heading", { name: "New session" }),
    ).toBeInTheDocument();
  });

  it("shows a sonner toast and keeps the modal open when server returns NAME_COLLISION", async () => {
    const user = userEvent.setup();
    createSession.mockResolvedValueOnce({
      success: false,
      error: { code: "NAME_COLLISION", message: "x" },
    });
    render(<CreateSessionDialog />);
    await user.click(screen.getByRole("button", { name: "New session" }));
    await user.click(screen.getByRole("button", { name: "Create" }));
    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith(
        "Couldn't create a session — please try again.",
      ),
    );
    expect(push).not.toHaveBeenCalled();
    expect(
      screen.getByRole("heading", { name: "New session" }),
    ).toBeInTheDocument();
  });
});
