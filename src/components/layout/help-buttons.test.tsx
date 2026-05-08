import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { HelpButtons, HELP_ENABLED } from "./help-buttons";

describe("HELP_ENABLED flag", () => {
  it("is enabled now that content tracks have shipped", () => {
    expect(HELP_ENABLED).toBe(true);
  });
});

describe("HelpButtons", () => {
  it("renders the two help buttons with icon + label", () => {
    render(<HelpButtons />);
    expect(
      screen.getByRole("button", { name: "Hand rankings" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "How to play" }),
    ).toBeInTheDocument();
    // Visible labels:
    expect(screen.getByText("Rankings")).toBeInTheDocument();
    expect(screen.getByText("Rules")).toBeInTheDocument();
  });

  it("opens the hand-rankings cheatsheet when 'Rankings' is clicked", async () => {
    const user = userEvent.setup();
    render(<HelpButtons />);
    await user.click(screen.getByRole("button", { name: "Hand rankings" }));
    await waitFor(() =>
      expect(
        screen.getByText("Hand rankings (Texas Hold'em)"),
      ).toBeInTheDocument(),
    );
  });

  it("opens the how-to-play guide when 'Rules' is clicked", async () => {
    const user = userEvent.setup();
    render(<HelpButtons />);
    await user.click(screen.getByRole("button", { name: "How to play" }));
    await waitFor(() =>
      expect(
        screen.getByText("How to play (No-Limit Texas Hold'em)"),
      ).toBeInTheDocument(),
    );
  });
});
