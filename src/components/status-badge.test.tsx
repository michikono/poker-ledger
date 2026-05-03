import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StatusBadge } from "./status-badge";

describe("StatusBadge", () => {
  it("renders the in_progress label", () => {
    render(<StatusBadge status="in_progress" />);
    expect(screen.getByText("In Progress")).toBeInTheDocument();
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
});
