import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const mockPathname = vi.fn(() => "/sessions");
const mockSearchParams = vi.fn(() => new URLSearchParams());

vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname(),
  useSearchParams: () => mockSearchParams(),
}));

import { NavLink } from "./nav-link";

describe("NavLink — active state", () => {
  it("is not active when URL does not match", () => {
    mockPathname.mockReturnValue("/sessions");
    mockSearchParams.mockReturnValue(new URLSearchParams());
    render(<NavLink href="/sessions?status=in_progress">In Progress</NavLink>);
    const link = screen.getByRole("link", { name: "In Progress" });
    expect(link).not.toHaveClass("bg-accent");
  });

  it("is active when pathname and status param match", () => {
    mockPathname.mockReturnValue("/sessions");
    mockSearchParams.mockReturnValue(new URLSearchParams("status=in_progress"));
    render(<NavLink href="/sessions?status=in_progress">In Progress</NavLink>);
    const link = screen.getByRole("link", { name: "In Progress" });
    expect(link).toHaveClass("bg-accent");
  });

  it("is not active when status param differs", () => {
    mockPathname.mockReturnValue("/sessions");
    mockSearchParams.mockReturnValue(new URLSearchParams("status=settling"));
    render(<NavLink href="/sessions?status=in_progress">In Progress</NavLink>);
    const link = screen.getByRole("link", { name: "In Progress" });
    expect(link).not.toHaveClass("bg-accent");
  });

  it("is not active on /sessions (no status) for status links", () => {
    mockPathname.mockReturnValue("/sessions");
    mockSearchParams.mockReturnValue(new URLSearchParams());
    render(<NavLink href="/sessions?status=settled">Settled</NavLink>);
    expect(screen.getByRole("link", { name: "Settled" })).not.toHaveClass(
      "bg-accent",
    );
  });
});
