import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  addBuyIn: vi.fn(),
  getClientAuth: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("./actions", () => ({
  addBuyIn: (...args: unknown[]) => mocks.addBuyIn(...args),
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

import { AddBuyInModal } from "./add-buy-in-modal";

beforeEach(() => {
  mocks.addBuyIn.mockReset();
  mocks.refresh.mockReset();
  mocks.getClientAuth.mockReturnValue({
    authStateReady: () => Promise.resolve(),
    currentUser: { getIdToken: () => Promise.resolve("tok") },
  });
});

function renderModal(props?: Partial<Parameters<typeof AddBuyInModal>[0]>) {
  const onOpenChange = vi.fn();
  const utils = render(
    <AddBuyInModal
      open
      onOpenChange={onOpenChange}
      sessionId="s1"
      playerId="p1"
      playerName="Alice"
      {...props}
    />,
  );
  return { ...utils, onOpenChange };
}

describe("AddBuyInModal", () => {
  it("calls addBuyIn with parsed cents when submit is tapped", async () => {
    mocks.addBuyIn.mockResolvedValueOnce({
      success: true,
      data: { buyInId: "b1" },
    });
    const { onOpenChange } = renderModal();

    const input = screen.getByTestId(
      "add-buy-in-amount-p1",
    ) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "25" } });

    await act(async () => {
      fireEvent.click(screen.getByTestId("add-buy-in-submit-p1"));
    });

    expect(mocks.addBuyIn).toHaveBeenCalledTimes(1);
    expect(mocks.addBuyIn).toHaveBeenCalledWith(
      { sessionId: "s1", playerId: "p1", amountCents: 2500 },
      "tok",
    );
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(mocks.refresh).toHaveBeenCalledTimes(1);
  });

  it("submits when Enter is pressed inside the amount input", async () => {
    mocks.addBuyIn.mockResolvedValueOnce({
      success: true,
      data: { buyInId: "b1" },
    });
    renderModal();

    const input = screen.getByTestId(
      "add-buy-in-amount-p1",
    ) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "10" } });

    await act(async () => {
      fireEvent.keyDown(input, { key: "Enter" });
    });

    expect(mocks.addBuyIn).toHaveBeenCalledTimes(1);
    expect(mocks.addBuyIn).toHaveBeenCalledWith(
      { sessionId: "s1", playerId: "p1", amountCents: 1000 },
      "tok",
    );
  });

  it("shows a validation error when the amount is empty", async () => {
    renderModal();

    await act(async () => {
      fireEvent.click(screen.getByTestId("add-buy-in-submit-p1"));
    });

    expect(mocks.addBuyIn).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toMatch(/Enter an amount/);
  });

  it("shows a validation error for an invalid amount", async () => {
    renderModal();

    const input = screen.getByTestId(
      "add-buy-in-amount-p1",
    ) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "0" } });

    await act(async () => {
      fireEvent.click(screen.getByTestId("add-buy-in-submit-p1"));
    });

    expect(mocks.addBuyIn).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toMatch(/valid amount/);
  });

  it("surfaces server errors and keeps the modal open", async () => {
    mocks.addBuyIn.mockResolvedValueOnce({
      success: false,
      error: { code: "SESSION_NOT_EDITABLE", message: "" },
    });
    const { onOpenChange } = renderModal();

    const input = screen.getByTestId(
      "add-buy-in-amount-p1",
    ) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "25" } });

    await act(async () => {
      fireEvent.click(screen.getByTestId("add-buy-in-submit-p1"));
    });

    expect(mocks.addBuyIn).toHaveBeenCalledTimes(1);
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("Cancel closes without calling addBuyIn", () => {
    const { onOpenChange } = renderModal();

    fireEvent.click(screen.getByText("Cancel"));

    expect(mocks.addBuyIn).not.toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
