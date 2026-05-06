import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  markPaymentPaid: vi.fn(),
  unmarkPaymentPaid: vi.fn(),
  getClientAuth: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("./actions", () => ({
  markPaymentPaid: (...args: unknown[]) => mocks.markPaymentPaid(...args),
  unmarkPaymentPaid: (...args: unknown[]) => mocks.unmarkPaymentPaid(...args),
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

vi.mock("qrcode.react", () => ({
  QRCodeSVG: ({ value }: { value: string }) => (
    <svg data-testid="qr-svg" data-value={value} />
  ),
}));

import { PaymentList } from "./payment-list";
import type { SessionPaymentView, SessionPlayerView } from "./page";

function makePlayer(
  partial: Partial<SessionPlayerView> & Pick<SessionPlayerView, "id" | "name">,
): SessionPlayerView {
  return {
    venmoUsername: null,
    cashOutCents: 0,
    createdAt: new Date().toISOString(),
    buyIns: [],
    ...partial,
  };
}

function makePayment(
  partial: Partial<SessionPaymentView> &
    Pick<SessionPaymentView, "id" | "fromPlayerId" | "toPlayerId">,
): SessionPaymentView {
  return {
    amountCents: 1250,
    paid: false,
    paidAt: null,
    paidByUid: null,
    createdAt: new Date().toISOString(),
    ...partial,
  };
}

beforeEach(() => {
  mocks.markPaymentPaid.mockReset();
  mocks.unmarkPaymentPaid.mockReset();
  mocks.refresh.mockReset();
  mocks.getClientAuth.mockReturnValue({
    authStateReady: () => Promise.resolve(),
    currentUser: { getIdToken: () => Promise.resolve("tok") },
  });
});

describe("PaymentList — Venmo affordances", () => {
  const sessionCreatedAt = "2026-05-04T22:00:00.000Z";
  const sessionName = "friday-game";

  it("renders Pay and QR when payee has a Venmo handle", () => {
    render(
      <PaymentList
        sessionId="s1"
        status="settling"
        sessionName={sessionName}
        sessionCreatedAtIso={sessionCreatedAt}
        players={[
          makePlayer({ id: "alice", name: "Alice" }),
          makePlayer({
            id: "bob",
            name: "Bob",
            venmoUsername: "bob123",
          }),
        ]}
        payments={[
          makePayment({
            id: "pay-1",
            fromPlayerId: "alice",
            toPlayerId: "bob",
          }),
        ]}
      />,
    );

    const pay = screen.getByTestId("venmo-pay-pay-1");
    expect(pay).toHaveAttribute("href");
    expect(pay.getAttribute("href")).toContain("https://venmo.com/bob123");
    expect(pay.getAttribute("href")).toContain("amount=12.50");
    expect(pay.getAttribute("href")).toContain(
      "Poker%20on%202026-05-04%20(friday-game)",
    );
    expect(screen.getByTestId("venmo-qr-pay-1")).toBeInTheDocument();
    expect(screen.queryByTestId("add-venmo-cta-pay-1")).not.toBeInTheDocument();
  });

  it("renders only the Add Venmo CTA when payee has no handle", () => {
    render(
      <PaymentList
        sessionId="s1"
        status="settling"
        sessionName={sessionName}
        sessionCreatedAtIso={sessionCreatedAt}
        players={[
          makePlayer({ id: "alice", name: "Alice" }),
          makePlayer({ id: "bob", name: "Bob" }),
        ]}
        payments={[
          makePayment({
            id: "pay-1",
            fromPlayerId: "alice",
            toPlayerId: "bob",
          }),
        ]}
        onRequestEditPlayer={() => {}}
      />,
    );

    expect(screen.getByTestId("add-venmo-cta-pay-1")).toHaveTextContent(
      "Add Venmo for Bob",
    );
    expect(screen.queryByTestId("venmo-pay-pay-1")).not.toBeInTheDocument();
    expect(screen.queryByTestId("venmo-qr-pay-1")).not.toBeInTheDocument();
  });

  it("clicking the Add Venmo CTA calls onRequestEditPlayer with the payee's id", () => {
    const onRequestEditPlayer = vi.fn();
    render(
      <PaymentList
        sessionId="s1"
        status="settling"
        sessionName={sessionName}
        sessionCreatedAtIso={sessionCreatedAt}
        players={[
          makePlayer({ id: "alice", name: "Alice" }),
          makePlayer({ id: "bob", name: "Bob" }),
        ]}
        payments={[
          makePayment({
            id: "pay-1",
            fromPlayerId: "alice",
            toPlayerId: "bob",
          }),
        ]}
        onRequestEditPlayer={onRequestEditPlayer}
      />,
    );

    fireEvent.click(screen.getByTestId("add-venmo-cta-pay-1"));
    expect(onRequestEditPlayer).toHaveBeenCalledWith("bob");
  });

  it("hides the Add Venmo CTA when no onRequestEditPlayer prop is provided", () => {
    render(
      <PaymentList
        sessionId="s1"
        status="settling"
        sessionName={sessionName}
        sessionCreatedAtIso={sessionCreatedAt}
        players={[
          makePlayer({ id: "alice", name: "Alice" }),
          makePlayer({ id: "bob", name: "Bob" }),
        ]}
        payments={[
          makePayment({
            id: "pay-1",
            fromPlayerId: "alice",
            toPlayerId: "bob",
          }),
        ]}
      />,
    );

    expect(screen.queryByTestId("add-venmo-cta-pay-1")).not.toBeInTheDocument();
  });

  it("hides Pay, QR, and Add Venmo CTA once a payment is marked paid", () => {
    render(
      <PaymentList
        sessionId="s1"
        status="settled"
        sessionName={sessionName}
        sessionCreatedAtIso={sessionCreatedAt}
        players={[
          makePlayer({ id: "alice", name: "Alice" }),
          makePlayer({
            id: "bob",
            name: "Bob",
            venmoUsername: "bob123",
          }),
        ]}
        payments={[
          makePayment({
            id: "pay-1",
            fromPlayerId: "alice",
            toPlayerId: "bob",
            paid: true,
          }),
        ]}
      />,
    );

    expect(screen.queryByTestId("venmo-pay-pay-1")).not.toBeInTheDocument();
    expect(screen.queryByTestId("venmo-qr-pay-1")).not.toBeInTheDocument();
    expect(screen.queryByTestId("add-venmo-cta-pay-1")).not.toBeInTheDocument();
    expect(screen.getByText("Paid")).toBeInTheDocument();
  });

  it("opens the QR modal when QR button is clicked, encoding the same URL", () => {
    render(
      <PaymentList
        sessionId="s1"
        status="settling"
        sessionName={sessionName}
        sessionCreatedAtIso={sessionCreatedAt}
        players={[
          makePlayer({ id: "alice", name: "Alice" }),
          makePlayer({
            id: "bob",
            name: "Bob",
            venmoUsername: "bob123",
          }),
        ]}
        payments={[
          makePayment({
            id: "pay-1",
            fromPlayerId: "alice",
            toPlayerId: "bob",
          }),
        ]}
      />,
    );

    fireEvent.click(screen.getByTestId("venmo-qr-pay-1"));
    const qr = screen.getByTestId("qr-svg");
    expect(qr.getAttribute("data-value")).toContain("https://venmo.com/bob123");
    expect(qr.getAttribute("data-value")).toContain("amount=12.50");
  });
});
