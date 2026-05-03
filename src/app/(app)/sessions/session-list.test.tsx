import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { SessionStatus } from "@/lib/sessions/types";
import { SessionList } from "./session-list";

type SerializableSession = {
  id: string;
  name: string;
  status: SessionStatus;
  createdAt: string;
  playerCount: number;
};

function makeSession(
  partial: Partial<SerializableSession> & Pick<SerializableSession, "id">,
): SerializableSession {
  return {
    name: partial.id,
    status: "in_progress",
    createdAt: "2026-01-01T00:00:00.000Z",
    playerCount: 0,
    ...partial,
  };
}

describe("SessionList — empty state", () => {
  it("renders the no-sessions empty state when given an empty list", () => {
    render(<SessionList sessions={[]} />);
    expect(screen.getByText("No sessions yet.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "New Session" })).toBeDisabled();
    expect(
      screen.queryByRole("textbox", { name: /search/i }),
    ).not.toBeInTheDocument();
  });
});

describe("SessionList — populated state", () => {
  it("renders all sessions in a single page when count <= page size", () => {
    const sessions = [
      makeSession({ id: "alpha" }),
      makeSession({ id: "beta" }),
      makeSession({ id: "gamma" }),
    ];
    render(<SessionList sessions={sessions} />);
    expect(screen.getByText("alpha")).toBeInTheDocument();
    expect(screen.getByText("beta")).toBeInTheDocument();
    expect(screen.getByText("gamma")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /previous/i }),
    ).not.toBeInTheDocument();
  });

  it("filters the list by search query", async () => {
    const user = userEvent.setup();
    const sessions = [
      makeSession({ id: "crispy-salmon" }),
      makeSession({ id: "happy-tuna" }),
    ];
    render(<SessionList sessions={sessions} />);
    await user.type(screen.getByRole("textbox", { name: /search/i }), "tuna");
    expect(screen.queryByText("crispy-salmon")).not.toBeInTheDocument();
    expect(screen.getByText("happy-tuna")).toBeInTheDocument();
  });

  it("shows a no-match message when the search yields nothing", async () => {
    const user = userEvent.setup();
    const sessions = [makeSession({ id: "alpha" })];
    render(<SessionList sessions={sessions} />);
    await user.type(screen.getByRole("textbox", { name: /search/i }), "zzzzzz");
    expect(
      screen.getByText("No sessions match your search."),
    ).toBeInTheDocument();
  });

  it("paginates when there are more than 10 sessions", async () => {
    const user = userEvent.setup();
    const sessions = Array.from({ length: 15 }, (_, i) =>
      makeSession({
        id: `session-${i.toString().padStart(2, "0")}`,
        createdAt: new Date(2026, 0, 15 - i).toISOString(),
      }),
    );
    render(<SessionList sessions={sessions} />);
    expect(screen.getByText("session-00")).toBeInTheDocument();
    expect(screen.queryByText("session-14")).not.toBeInTheDocument();
    expect(screen.getByText(/Page 1 of 2/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /next/i }));

    expect(screen.queryByText("session-00")).not.toBeInTheDocument();
    expect(screen.getByText("session-14")).toBeInTheDocument();
    expect(screen.getByText(/Page 2 of 2/)).toBeInTheDocument();
  });
});
