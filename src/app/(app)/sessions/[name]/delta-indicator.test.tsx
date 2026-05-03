import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DeltaIndicator } from "./delta-indicator";

describe("DeltaIndicator", () => {
  it("shows 'No buy-ins yet' when total buy-in is zero", () => {
    render(
      <DeltaIndicator
        totals={{
          totalBuyInCents: 0,
          totalCashOutCents: 0,
          shortfallCents: 0,
        }}
      />,
    );
    const el = screen.getByTestId("delta-indicator");
    expect(el).toHaveAttribute("data-state", "no_buy_ins");
    expect(el).toHaveTextContent("No buy-ins yet");
  });

  it("shows balanced label and green class when shortfall ≤ 2%", () => {
    render(
      <DeltaIndicator
        totals={{
          totalBuyInCents: 10000,
          totalCashOutCents: 9900,
          shortfallCents: 100,
        }}
      />,
    );
    const el = screen.getByTestId("delta-indicator");
    expect(el).toHaveAttribute("data-state", "balanced");
    expect(el).toHaveTextContent("$1.00 short");
    expect(el.className).toMatch(/emerald/);
  });

  it("shows out-of-range with red class when over-cashed", () => {
    render(
      <DeltaIndicator
        totals={{
          totalBuyInCents: 10000,
          totalCashOutCents: 11000,
          shortfallCents: -1000,
        }}
      />,
    );
    const el = screen.getByTestId("delta-indicator");
    expect(el).toHaveAttribute("data-state", "out_of_range");
    expect(el).toHaveTextContent("$10.00 over");
    expect(el.className).toMatch(/rose/);
  });

  it("shows balanced label when shortfall is zero", () => {
    render(
      <DeltaIndicator
        totals={{
          totalBuyInCents: 10000,
          totalCashOutCents: 10000,
          shortfallCents: 0,
        }}
      />,
    );
    const el = screen.getByTestId("delta-indicator");
    expect(el).toHaveAttribute("data-state", "balanced");
    expect(el).toHaveTextContent("Balanced");
  });
});
