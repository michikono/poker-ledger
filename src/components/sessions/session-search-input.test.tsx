import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  getIdToken: vi.fn().mockResolvedValue("test-token"),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push }),
}));

vi.mock("@/lib/firebase/client", () => ({
  getClientAuth: () => ({
    currentUser: { getIdToken: () => mocks.getIdToken() },
  }),
}));

import { SessionSearchInput } from "./session-search-input";

const RESULTS = [
  {
    name: "crispy-salmon-001",
    status: "in_progress",
    created_at: "2026-01-01T00:00:00.000Z",
    match_kind: "prefix",
  },
  {
    name: "apple-crispy-002",
    status: "settled",
    created_at: "2026-01-02T00:00:00.000Z",
    match_kind: "contains",
  },
];

function mockFetchSuccess(results = RESULTS) {
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => results,
  } as unknown as Response);
}

async function typeAndWait(input: HTMLElement, value: string) {
  await act(async () => {
    fireEvent.change(input, { target: { value } });
    vi.advanceTimersByTime(300);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  mockFetchSuccess();
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe("SessionSearchInput", () => {
  it("renders an input", () => {
    render(<SessionSearchInput />);
    expect(screen.getByRole("combobox")).toBeInTheDocument();
  });

  it("does not fetch when query is fewer than 2 characters", async () => {
    render(<SessionSearchInput />);
    const input = screen.getByRole("combobox");
    await act(async () => {
      fireEvent.change(input, { target: { value: "a" } });
      vi.advanceTimersByTime(400);
    });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("fetches after 2+ characters with 300ms debounce", async () => {
    render(<SessionSearchInput />);
    const input = screen.getByRole("combobox");
    fireEvent.change(input, { target: { value: "cr" } });
    expect(global.fetch).not.toHaveBeenCalled();
    await act(async () => {
      vi.advanceTimersByTime(300);
    });
    expect(global.fetch).toHaveBeenCalledOnce();
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("q=cr"),
      expect.objectContaining({ headers: expect.any(Object) }),
    );
  });

  it("only fires one fetch for rapid typing (debounce)", async () => {
    render(<SessionSearchInput />);
    const input = screen.getByRole("combobox");
    await act(async () => {
      fireEvent.change(input, { target: { value: "cr" } });
      vi.advanceTimersByTime(100);
      fireEvent.change(input, { target: { value: "cri" } });
      vi.advanceTimersByTime(100);
      fireEvent.change(input, { target: { value: "crisp" } });
      vi.advanceTimersByTime(300);
    });
    expect(global.fetch).toHaveBeenCalledOnce();
  });

  it("renders result rows with session names after debounce", async () => {
    render(<SessionSearchInput />);
    const input = screen.getByRole("combobox");
    await typeAndWait(input, "cr");
    expect(screen.getByText("crispy-salmon-001")).toBeInTheDocument();
    expect(screen.getByText("apple-crispy-002")).toBeInTheDocument();
  });

  it("closes dropdown when query drops below 2 characters", async () => {
    render(<SessionSearchInput />);
    const input = screen.getByRole("combobox");
    await typeAndWait(input, "cr");
    expect(screen.getByText("crispy-salmon-001")).toBeInTheDocument();
    await act(async () => {
      fireEvent.change(input, { target: { value: "c" } });
    });
    expect(screen.queryByText("crispy-salmon-001")).not.toBeInTheDocument();
  });

  it("navigates to session on click", async () => {
    render(<SessionSearchInput />);
    const input = screen.getByRole("combobox");
    await typeAndWait(input, "cr");
    act(() => {
      fireEvent.mouseDown(screen.getByText("crispy-salmon-001"));
    });
    expect(mocks.push).toHaveBeenCalledWith("/sessions/crispy-salmon-001");
  });

  it("calls onSelect callback after click selection", async () => {
    const onSelect = vi.fn();
    render(<SessionSearchInput onSelect={onSelect} />);
    const input = screen.getByRole("combobox");
    await typeAndWait(input, "cr");
    act(() => {
      fireEvent.mouseDown(screen.getByText("crispy-salmon-001"));
    });
    expect(onSelect).toHaveBeenCalledOnce();
  });

  it("clears input and closes dropdown after selection", async () => {
    render(<SessionSearchInput />);
    const input = screen.getByRole("combobox");
    await typeAndWait(input, "cr");
    act(() => {
      fireEvent.mouseDown(screen.getByText("crispy-salmon-001"));
    });
    expect(input).toHaveValue("");
    expect(screen.queryByText("crispy-salmon-001")).not.toBeInTheDocument();
  });

  it("arrow keys change the active item", async () => {
    render(<SessionSearchInput />);
    const input = screen.getByRole("combobox");
    await typeAndWait(input, "cr");
    const options = screen.getAllByRole("option");
    expect(options[0]).toHaveAttribute("aria-selected", "false");
    act(() => {
      fireEvent.keyDown(input, { key: "ArrowDown" });
    });
    expect(options[0]).toHaveAttribute("aria-selected", "true");
    act(() => {
      fireEvent.keyDown(input, { key: "ArrowDown" });
    });
    expect(options[1]).toHaveAttribute("aria-selected", "true");
  });

  it("Enter on active item navigates and calls onSelect", async () => {
    const onSelect = vi.fn();
    render(<SessionSearchInput onSelect={onSelect} />);
    const input = screen.getByRole("combobox");
    await typeAndWait(input, "cr");
    act(() => {
      fireEvent.keyDown(input, { key: "ArrowDown" });
    });
    act(() => {
      fireEvent.keyDown(input, { key: "Enter" });
    });
    expect(mocks.push).toHaveBeenCalledWith("/sessions/crispy-salmon-001");
    expect(onSelect).toHaveBeenCalledOnce();
  });

  it("Escape closes the dropdown without navigating", async () => {
    render(<SessionSearchInput />);
    const input = screen.getByRole("combobox");
    await typeAndWait(input, "cr");
    expect(screen.getByText("crispy-salmon-001")).toBeInTheDocument();
    act(() => {
      fireEvent.keyDown(input, { key: "Escape" });
    });
    expect(screen.queryByText("crispy-salmon-001")).not.toBeInTheDocument();
    expect(mocks.push).not.toHaveBeenCalled();
  });

  it("arrow keys wrap: ArrowUp from -1 goes to last, ArrowDown from last wraps to first", async () => {
    render(<SessionSearchInput />);
    const input = screen.getByRole("combobox");
    await typeAndWait(input, "cr");
    const options = screen.getAllByRole("option");
    // Start at -1 (no selection), ArrowUp wraps to last
    act(() => {
      fireEvent.keyDown(input, { key: "ArrowUp" });
    });
    expect(options[options.length - 1]).toHaveAttribute(
      "aria-selected",
      "true",
    );
    // ArrowDown from last wraps to first
    act(() => {
      fireEvent.keyDown(input, { key: "ArrowDown" });
    });
    expect(options[0]).toHaveAttribute("aria-selected", "true");
  });
});
