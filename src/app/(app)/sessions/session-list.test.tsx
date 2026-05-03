import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { SessionStatus } from "@/lib/sessions/types";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/sessions",
  useSearchParams: () => new URLSearchParams(),
}));

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

const EMPTY_GROUPS = {
  in_progress: [] as SerializableSession[],
  settling: [] as SerializableSession[],
  settled: [] as SerializableSession[],
  archived: [] as SerializableSession[],
};

describe("SessionList (mode=all) — empty state", () => {
  it("renders the empty state message when all groups are empty", () => {
    render(<SessionList mode="all" groups={EMPTY_GROUPS} />);
    expect(screen.getByText("No sessions yet.")).toBeInTheDocument();
  });
});

describe("SessionList (mode=all) — populated state", () => {
  it("renders all four section headings", () => {
    const groups = {
      ...EMPTY_GROUPS,
      in_progress: [makeSession({ id: "alpha" })],
    };
    render(<SessionList mode="all" groups={groups} />);
    expect(
      screen.getByRole("heading", { name: "In Progress" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Settling" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Settled" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Archived" }),
    ).toBeInTheDocument();
  });

  it("renders sessions in their correct sections", () => {
    const groups = {
      in_progress: [makeSession({ id: "alpha" })],
      settling: [makeSession({ id: "beta", status: "settling" })],
      settled: [] as SerializableSession[],
      archived: [] as SerializableSession[],
    };
    render(<SessionList mode="all" groups={groups} />);
    expect(screen.getByText("alpha")).toBeInTheDocument();
    expect(screen.getByText("beta")).toBeInTheDocument();
  });

  it("shows per-section empty messages for empty sections", () => {
    const groups = {
      ...EMPTY_GROUPS,
      in_progress: [makeSession({ id: "alpha" })],
    };
    render(<SessionList mode="all" groups={groups} />);
    expect(screen.getByText("No sessions settling.")).toBeInTheDocument();
    expect(screen.getByText("No settled sessions.")).toBeInTheDocument();
    expect(screen.getByText("No archived sessions.")).toBeInTheDocument();
  });
});

describe("SessionList (mode=filtered)", () => {
  it("renders only the matching section without pagination when count <= page size", () => {
    const sessions = [
      makeSession({ id: "alpha" }),
      makeSession({ id: "beta" }),
    ];
    render(
      <SessionList
        mode="filtered"
        filter="in_progress"
        sessions={sessions}
        currentPage={1}
        totalCount={2}
        pageSize={10}
      />,
    );
    expect(screen.getByText("alpha")).toBeInTheDocument();
    expect(screen.getByText("beta")).toBeInTheDocument();
    expect(screen.queryByText(/Page/)).not.toBeInTheDocument();
  });

  it("shows pagination controls when total exceeds page size", () => {
    const sessions = Array.from({ length: 10 }, (_, i) =>
      makeSession({ id: `session-${i}` }),
    );
    render(
      <SessionList
        mode="filtered"
        filter="in_progress"
        sessions={sessions}
        currentPage={1}
        totalCount={15}
        pageSize={10}
      />,
    );
    expect(screen.getByText(/Page 1 of 2/)).toBeInTheDocument();
    expect(screen.getByText("Next")).toBeInTheDocument();
    expect(screen.getByText("Previous")).toBeInTheDocument();
  });

  it("shows empty state for filtered view with no sessions", () => {
    render(
      <SessionList
        mode="filtered"
        filter="settling"
        sessions={[]}
        currentPage={1}
        totalCount={0}
        pageSize={10}
      />,
    );
    expect(screen.getByText("No sessions settling.")).toBeInTheDocument();
  });
});
