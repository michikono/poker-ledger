import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { HelpModal } from "./help-modal";

describe("HelpModal", () => {
  it("renders the title and body when open", () => {
    render(
      <HelpModal open onOpenChange={() => {}} title="Hand rankings">
        <p>Royal flush is the best.</p>
      </HelpModal>,
    );
    expect(screen.getByText("Hand rankings")).toBeInTheDocument();
    expect(screen.getByText("Royal flush is the best.")).toBeInTheDocument();
  });

  it("does not render the body when closed", () => {
    render(
      <HelpModal open={false} onOpenChange={() => {}} title="Hand rankings">
        <p>Should not be visible.</p>
      </HelpModal>,
    );
    expect(screen.queryByText("Should not be visible.")).toBeNull();
  });

  it("body has pb-20 padding (so the floating close button can't cover the last paragraph)", () => {
    render(
      <HelpModal open onOpenChange={() => {}} title="X">
        <p>content</p>
      </HelpModal>,
    );
    const body = document.querySelector('[data-slot="help-modal-body"]');
    expect(body).not.toBeNull();
    expect(body?.className).toContain("pb-20");
  });

  it("close button calls onOpenChange(false) when clicked", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(
      <HelpModal open onOpenChange={onOpenChange} title="X">
        <p>content</p>
      </HelpModal>,
    );
    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(onOpenChange).toHaveBeenCalled();
    // base-ui passes (open, event, reason) — check the first argument only.
    expect(onOpenChange.mock.calls[0]?.[0]).toBe(false);
  });
});
