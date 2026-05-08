import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/sign-in/actions", () => ({
  signOut: vi.fn(),
}));

vi.mock("@/components/sessions/session-search-input", () => ({
  SessionSearchInput: () => <div data-testid="session-search" />,
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/sessions",
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

import { Header } from "./header";

describe("Header (mobile)", () => {
  it("opens the side sheet with sidebar background when the menu button is clicked", async () => {
    const user = userEvent.setup();
    render(
      <Header firstName="Jane" navCounts={{ in_progress: 0, settling: 0 }} />,
    );

    await user.click(screen.getByRole("button", { name: "Open menu" }));

    const sheet = document.querySelector('[data-slot="sheet-content"]');
    expect(sheet).not.toBeNull();
    // The fix: sidebar bg + sidebar text colors so nav links aren't
    // white-on-white in light mode.
    expect(sheet?.className).toContain("bg-sidebar");
    expect(sheet?.className).toContain("text-sidebar-foreground");
  });
});
