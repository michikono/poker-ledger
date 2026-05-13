import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ActivityLog } from "./activity-log";

describe("ActivityLog", () => {
  it("renders empty state when no entries", () => {
    render(<ActivityLog entries={[]} />);
    expect(screen.getByText(/No activity yet/)).toBeInTheDocument();
  });

  it("renders entries with markdown bold for money", () => {
    render(
      <ActivityLog
        entries={[
          {
            id: "e1",
            actorUid: "u1",
            actorName: "Alice",
            actionType: "buy_in_added",
            description: "Alice added **$50.00** buy-in for Bob.",
            createdAt: new Date().toISOString(),
          },
        ]}
      />,
    );
    expect(screen.getByText(/Alice added/)).toBeInTheDocument();
    const strong = screen.getByTestId("activity-log").querySelector("strong");
    expect(strong?.textContent).toBe("$50.00");
  });

  it("shows actor name in the meta line", () => {
    render(
      <ActivityLog
        entries={[
          {
            id: "e1",
            actorUid: "u1",
            actorName: "Charlene",
            actionType: "player_added",
            description: "Charlene added player Dan.",
            createdAt: new Date().toISOString(),
          },
        ]}
      />,
    );
    const meta = screen
      .getByTestId("activity-log")
      .querySelector(".text-muted-foreground");
    expect(meta?.textContent).toContain("Charlene");
  });

  // Spec 0020: replaced native `title=` attribute with a Tooltip so keyboard
  // users can reach the absolute timestamp. Trigger is a button (focusable)
  // and exposes the absolute time via aria-label.
  it("exposes the absolute timestamp via a focusable trigger", () => {
    const iso = "2026-05-12T14:30:00.000Z";
    render(
      <ActivityLog
        entries={[
          {
            id: "e1",
            actorUid: "u1",
            actorName: "Alice",
            actionType: "buy_in_added",
            description: "Alice added $50.00 buy-in.",
            createdAt: iso,
          },
        ]}
      />,
    );
    const trigger = screen
      .getByTestId("activity-log")
      .querySelector("button[aria-label^='Logged ']");
    expect(trigger).not.toBeNull();
    // The absolute timestamp from `toLocaleString()` must be present in the
    // aria-label so screen readers and keyboard users can reach it.
    expect(trigger?.getAttribute("aria-label")).toContain(
      new Date(iso).toLocaleString(),
    );
  });
});
