import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FilterPills } from "./filter-pills";

describe("FilterPills", () => {
  it("renders all four status pills", () => {
    render(<FilterPills />);
    expect(
      screen.getByRole("link", { name: "In Progress" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Settling" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Settled" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Archived" })).toBeInTheDocument();
  });

  it("no pill is active when activeFilter is undefined", () => {
    render(<FilterPills />);
    const pills = screen.getAllByRole("link");
    for (const pill of pills) {
      expect(pill).not.toHaveClass("bg-accent");
    }
  });

  it("marks the matching pill as active", () => {
    render(<FilterPills activeFilter="settling" />);
    const active = screen.getByRole("link", { name: "Settling" });
    expect(active).toHaveClass("bg-accent");
  });

  it("inactive pills link to their status filter URL", () => {
    render(<FilterPills activeFilter="in_progress" />);
    expect(screen.getByRole("link", { name: "Settling" })).toHaveAttribute(
      "href",
      "/sessions?status=settling",
    );
  });

  it("active pill links back to /sessions to deactivate", () => {
    render(<FilterPills activeFilter="settled" />);
    expect(screen.getByRole("link", { name: "Settled" })).toHaveAttribute(
      "href",
      "/sessions",
    );
  });
});
