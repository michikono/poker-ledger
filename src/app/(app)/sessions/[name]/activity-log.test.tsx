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
});
