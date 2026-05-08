import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { HAND_RANKINGS } from "@/lib/help/hand-rankings-data";
import { HandRankingsCheatsheet } from "./hand-rankings";

describe("HandRankingsCheatsheet", () => {
  it("renders all 10 hand names in strongest → weakest order", () => {
    render(<HandRankingsCheatsheet open onOpenChange={() => {}} />);

    // Get the body of the help modal — exclude the modal's own title <h2>.
    const body = document.querySelector('[data-slot="help-modal-body"]');
    expect(body).not.toBeNull();
    const headings = Array.from(body?.querySelectorAll("h2") ?? []).map((h) =>
      h.textContent?.trim(),
    );

    expect(headings).toEqual(HAND_RANKINGS.map((h) => h.name));
  });

  it("renders an SVG <img> with descriptive alt text for every hand", () => {
    render(<HandRankingsCheatsheet open onOpenChange={() => {}} />);

    for (const hand of HAND_RANKINGS) {
      const img = screen.getByAltText(`${hand.name} example`);
      expect(img).toBeInTheDocument();
      expect(img.getAttribute("src")).toBe(hand.svgPath);
    }
  });

  it("renders the odds label for each hand", () => {
    render(<HandRankingsCheatsheet open onOpenChange={() => {}} />);

    for (const hand of HAND_RANKINGS) {
      expect(screen.getByText(hand.oddsLabel)).toBeInTheDocument();
    }
  });

  it("renders the modal title and intro note", () => {
    render(<HandRankingsCheatsheet open onOpenChange={() => {}} />);
    expect(
      screen.getByText("Hand rankings (Texas Hold'em)"),
    ).toBeInTheDocument();
    expect(screen.getByText(/From strongest to weakest\./)).toBeInTheDocument();
  });

  it("does not render content when closed", () => {
    render(<HandRankingsCheatsheet open={false} onOpenChange={() => {}} />);
    expect(screen.queryByText("Hand rankings (Texas Hold'em)")).toBeNull();
  });
});
