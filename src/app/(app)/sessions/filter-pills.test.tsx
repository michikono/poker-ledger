import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FilterPills } from "./filter-pills";

describe("FilterPills", () => {
  it("renders all five pills including All", () => {
    render(<FilterPills />);
    expect(screen.getByRole("link", { name: "All" })).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "In Progress" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Settling" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Settled" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Archived" })).toBeInTheDocument();
  });

  it("All pill is active when no filter is set", () => {
    render(<FilterPills />);
    expect(screen.getByRole("link", { name: "All" })).toHaveClass("bg-accent");
  });

  it("no status pill is active when activeFilter is undefined", () => {
    render(<FilterPills />);
    for (const name of ["In Progress", "Settling", "Settled", "Archived"]) {
      expect(screen.getByRole("link", { name })).not.toHaveClass("bg-accent");
    }
  });

  it("marks the matching status pill as active", () => {
    render(<FilterPills activeFilter="settling" />);
    expect(screen.getByRole("link", { name: "Settling" })).toHaveClass(
      "bg-accent",
    );
    expect(screen.getByRole("link", { name: "All" })).not.toHaveClass(
      "bg-accent",
    );
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
