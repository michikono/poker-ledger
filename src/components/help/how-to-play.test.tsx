import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { HowToPlayGuide } from "./how-to-play";

const SECTION_HEADINGS = [
  "The goal of a hand",
  "Who deals; the button",
  "Forced bets — the blinds",
  "The deal",
  "The four rounds of betting (the streets)",
  "Burn cards",
  "What you can do on your turn — the betting actions",
  "How big can you bet? (No-limit)",
  "The minimum bet and minimum raise",
  "All-in and side pots",
  "Showdown — who wins",
  "Buying in",
  "Joining the table mid-game",
];

describe("HowToPlayGuide", () => {
  it("renders all section headings", () => {
    render(<HowToPlayGuide open onOpenChange={() => {}} />);
    for (const heading of SECTION_HEADINGS) {
      expect(
        screen.getByRole("heading", { level: 2, name: heading }),
      ).toBeInTheDocument();
    }
  });

  it("introduces the key poker terms (jargon-introduction smoke check)", () => {
    render(<HowToPlayGuide open onOpenChange={() => {}} />);
    // Canary terms — if any of these stop appearing in the rendered prose,
    // the parenthetical introduction probably got dropped during a rename
    // and the guide is no longer newbie-friendly.
    const body = document.body.textContent ?? "";
    expect(body).toMatch(/hole cards/);
    expect(body).toMatch(/the river/i);
    expect(body).toMatch(/small blind/);
    expect(body).toMatch(/big blind/);
  });

  it("has six expandable worked examples, all collapsed by default", () => {
    render(<HowToPlayGuide open onOpenChange={() => {}} />);
    const detailsEls = document.querySelectorAll("details");
    expect(detailsEls.length).toBe(6);
    for (const d of detailsEls) {
      expect(d.hasAttribute("open")).toBe(false);
    }
  });

  it("each example expands when its summary is clicked", async () => {
    const user = userEvent.setup();
    render(<HowToPlayGuide open onOpenChange={() => {}} />);
    const summaries = screen.getAllByText("Show me an example");
    expect(summaries).toHaveLength(6);
    for (const summary of summaries) {
      await user.click(summary);
      const parent = summary.closest("details");
      expect(parent?.hasAttribute("open")).toBe(true);
    }
  });

  it("renders the blinds diagram with an accessible title", () => {
    render(<HowToPlayGuide open onOpenChange={() => {}} />);
    const titleEl = document.getElementById("blinds-diagram-title");
    expect(titleEl).not.toBeNull();
    expect(titleEl?.textContent).toMatch(/dealer.*small blind.*big blind/i);
  });

  it("renders the streets-progression diagram with all four round labels", () => {
    render(<HowToPlayGuide open onOpenChange={() => {}} />);
    expect(screen.getByText("Pre-flop")).toBeInTheDocument();
    expect(screen.getByText("Flop")).toBeInTheDocument();
    expect(screen.getByText("Turn")).toBeInTheDocument();
    expect(screen.getByText("River")).toBeInTheDocument();
    expect(screen.getByText(/no community cards yet/i)).toBeInTheDocument();
  });

  it("explains burn cards (counts: 1 before flop, 1 before turn, 1 before river)", () => {
    render(<HowToPlayGuide open onOpenChange={() => {}} />);
    expect(
      screen.getByRole("heading", { level: 2, name: "Burn cards" }),
    ).toBeInTheDocument();
    const body = document.body.textContent ?? "";
    expect(body).toMatch(/burn 1, deal 3/i);
  });

  it("does not render content when closed", () => {
    render(<HowToPlayGuide open={false} onOpenChange={() => {}} />);
    expect(screen.queryByText("The goal of a hand")).toBeNull();
  });
});
