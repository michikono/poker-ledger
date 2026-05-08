import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const replace = vi.fn();
let currentSearchString = "";

vi.mock("next/navigation", () => ({
  usePathname: () => "/sessions/abc",
  useRouter: () => ({ replace, push: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(currentSearchString),
}));

import { HELP_ENABLED, HELP_PARAM, HelpButtons } from "./help-buttons";

beforeEach(() => {
  replace.mockReset();
  currentSearchString = "";
});

describe("HELP_ENABLED flag", () => {
  it("is enabled now that content tracks have shipped", () => {
    expect(HELP_ENABLED).toBe(true);
  });
});

describe("HELP_PARAM constant", () => {
  it("is the search-param key used for deep-linking", () => {
    expect(HELP_PARAM).toBe("help");
  });
});

describe("HelpButtons", () => {
  it("renders the two help buttons with icon + label", async () => {
    render(<HelpButtons />);
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Hand rankings" }),
      ).toBeEnabled(),
    );
    expect(
      screen.getByRole("button", { name: "How to play" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Cheat sheet")).toBeInTheDocument();
    expect(screen.getByText("Rules")).toBeInTheDocument();
  });

  it("opens the cheatsheet via URL param when ?help=cheatsheet is present", async () => {
    currentSearchString = "help=cheatsheet";
    render(<HelpButtons />);
    await waitFor(() =>
      expect(
        screen.getByText("Hand rankings (Texas Hold'em)"),
      ).toBeInTheDocument(),
    );
  });

  it("opens the rules guide via URL param when ?help=rules is present", async () => {
    currentSearchString = "help=rules";
    render(<HelpButtons />);
    await waitFor(() =>
      expect(
        screen.getByText("How to play (No-Limit Texas Hold'em)"),
      ).toBeInTheDocument(),
    );
  });

  it("clicking 'Cheat sheet' updates the URL to ?help=cheatsheet", async () => {
    const user = userEvent.setup();
    render(<HelpButtons />);
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Hand rankings" }),
      ).toBeEnabled(),
    );
    await user.click(screen.getByRole("button", { name: "Hand rankings" }));
    expect(replace).toHaveBeenCalledWith(
      "/sessions/abc?help=cheatsheet",
      expect.objectContaining({ scroll: false }),
    );
  });

  it("clicking 'Rules' updates the URL to ?help=rules", async () => {
    const user = userEvent.setup();
    render(<HelpButtons />);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "How to play" })).toBeEnabled(),
    );
    await user.click(screen.getByRole("button", { name: "How to play" }));
    expect(replace).toHaveBeenCalledWith(
      "/sessions/abc?help=rules",
      expect.objectContaining({ scroll: false }),
    );
  });

  it("preserves other search params when deep-linking", async () => {
    currentSearchString = "status=in_progress&page=2";
    const user = userEvent.setup();
    render(<HelpButtons />);
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Hand rankings" }),
      ).toBeEnabled(),
    );
    await user.click(screen.getByRole("button", { name: "Hand rankings" }));
    expect(replace).toHaveBeenCalledWith(
      expect.stringMatching(/^\/sessions\/abc\?/),
      expect.objectContaining({ scroll: false }),
    );
    const calledUrl = replace.mock.calls[0]?.[0] as string;
    expect(calledUrl).toContain("status=in_progress");
    expect(calledUrl).toContain("page=2");
    expect(calledUrl).toContain("help=cheatsheet");
  });

  it("closing the modal removes only the help param", async () => {
    currentSearchString = "status=in_progress&help=cheatsheet";
    render(<HelpButtons />);
    await waitFor(() =>
      expect(
        screen.getByText("Hand rankings (Texas Hold'em)"),
      ).toBeInTheDocument(),
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(replace).toHaveBeenCalledWith(
      "/sessions/abc?status=in_progress",
      expect.objectContaining({ scroll: false }),
    );
  });

  it("closing the modal returns to a clean URL when no other params are present", async () => {
    currentSearchString = "help=rules";
    render(<HelpButtons />);
    await waitFor(() =>
      expect(
        screen.getByText("How to play (No-Limit Texas Hold'em)"),
      ).toBeInTheDocument(),
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(replace).toHaveBeenCalledWith(
      "/sessions/abc",
      expect.objectContaining({ scroll: false }),
    );
  });
});
