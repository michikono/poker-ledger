import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  updateDefaultBuyIn: vi.fn(),
  getClientAuth: vi.fn(),
  refresh: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("./actions", () => ({
  updateDefaultBuyIn: (...args: unknown[]) => mocks.updateDefaultBuyIn(...args),
}));

vi.mock("@/lib/firebase/client", () => ({
  getClientAuth: () => mocks.getClientAuth(),
}));

vi.mock("sonner", () => ({
  toast: {
    error: (msg: string) => mocks.toastError(msg),
    success: vi.fn(),
  },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: () => mocks.refresh() }),
}));

import { DefaultBuyInModal } from "./default-buy-in-modal";

beforeEach(() => {
  mocks.updateDefaultBuyIn.mockReset();
  mocks.refresh.mockReset();
  mocks.toastError.mockReset();
  mocks.getClientAuth.mockReturnValue({
    authStateReady: () => Promise.resolve(),
    currentUser: { getIdToken: () => Promise.resolve("tok") },
  });
});

function renderModal(defaultBuyInCents: number | null = 2500) {
  const onOpenChange = vi.fn();
  const utils = render(
    <DefaultBuyInModal
      open
      onOpenChange={onOpenChange}
      sessionId="s1"
      defaultBuyInCents={defaultBuyInCents}
    />,
  );
  return { ...utils, onOpenChange };
}

describe("DefaultBuyInModal", () => {
  it("calls updateDefaultBuyIn with parsed cents on submit", async () => {
    mocks.updateDefaultBuyIn.mockResolvedValueOnce({ success: true });
    const { onOpenChange } = renderModal(2500);

    const input = screen.getByTestId(
      "default-buy-in-amount",
    ) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "50" } });

    await act(async () => {
      fireEvent.click(screen.getByTestId("default-buy-in-submit"));
    });

    expect(mocks.updateDefaultBuyIn).toHaveBeenCalledTimes(1);
    expect(mocks.updateDefaultBuyIn).toHaveBeenCalledWith(
      { sessionId: "s1", amountCents: 5000 },
      "tok",
    );
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(mocks.refresh).toHaveBeenCalled();
  });

  it("clears the default when the input is left blank", async () => {
    mocks.updateDefaultBuyIn.mockResolvedValueOnce({ success: true });
    renderModal(2500);

    const input = screen.getByTestId(
      "default-buy-in-amount",
    ) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "" } });

    await act(async () => {
      fireEvent.click(screen.getByTestId("default-buy-in-submit"));
    });

    expect(mocks.updateDefaultBuyIn).toHaveBeenCalledWith(
      { sessionId: "s1", amountCents: null },
      "tok",
    );
  });

  it("submits via Enter on the input", async () => {
    mocks.updateDefaultBuyIn.mockResolvedValueOnce({ success: true });
    renderModal(null);

    const input = screen.getByTestId(
      "default-buy-in-amount",
    ) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "20" } });

    await act(async () => {
      fireEvent.keyDown(input, { key: "Enter" });
    });

    expect(mocks.updateDefaultBuyIn).toHaveBeenCalledWith(
      { sessionId: "s1", amountCents: 2000 },
      "tok",
    );
  });

  it("shows a validation error for an invalid amount and does not submit", async () => {
    renderModal(2500);

    const input = screen.getByTestId(
      "default-buy-in-amount",
    ) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "0" } });

    await act(async () => {
      fireEvent.click(screen.getByTestId("default-buy-in-submit"));
    });

    expect(mocks.updateDefaultBuyIn).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toMatch(/valid amount/);
  });

  it("Cancel closes without calling updateDefaultBuyIn", () => {
    const { onOpenChange } = renderModal(2500);

    fireEvent.click(screen.getByText("Cancel"));

    expect(mocks.updateDefaultBuyIn).not.toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("does not call updateDefaultBuyIn when the value is unchanged", async () => {
    const { onOpenChange } = renderModal(2500);

    await act(async () => {
      fireEvent.click(screen.getByTestId("default-buy-in-submit"));
    });

    // 25.00 prefilled === 2500 cents, no change → close without server call.
    expect(mocks.updateDefaultBuyIn).not.toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
