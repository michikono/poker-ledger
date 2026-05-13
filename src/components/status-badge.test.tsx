import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { SessionStatus } from "@/lib/sessions/types";
import { StatusBadge } from "./status-badge";

describe("StatusBadge", () => {
  it("renders the in_progress label via formatStatus", () => {
    render(<StatusBadge status="in_progress" />);
    expect(screen.getByText("In progress")).toBeInTheDocument();
  });

  it("renders the settling label", () => {
    render(<StatusBadge status="settling" />);
    expect(screen.getByText("Settling")).toBeInTheDocument();
  });

  it("renders the settled label", () => {
    render(<StatusBadge status="settled" />);
    expect(screen.getByText("Settled")).toBeInTheDocument();
  });

  it("renders the archived label", () => {
    render(<StatusBadge status="archived" />);
    expect(screen.getByText("Archived")).toBeInTheDocument();
  });

  // Spec 0020: use the darker `*-fg` token for foreground so contrast meets
  // WCAG AA on tinted backgrounds. If a future refactor accidentally reverts
  // to the base `text-status-*` token, this fails.
  it.each<[SessionStatus, string]>([
    ["in_progress", "text-status-in-progress-fg"],
    ["settling", "text-status-settling-fg"],
    ["settled", "text-status-settled-fg"],
    ["archived", "text-status-archived-fg"],
  ])("uses the *-fg foreground token for %s", (status, fgClass) => {
    const { container } = render(<StatusBadge status={status} />);
    const badge = container.firstElementChild as HTMLElement;
    expect(badge.className).toContain(fgClass);
    expect(badge.className).not.toMatch(
      new RegExp(`text-status-${status.replace("_", "-")}(?!-fg)`),
    );
  });
});
