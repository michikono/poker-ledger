import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useActivityStatus } from "./use-activity-status";

const TIMEOUT = 1000;

function setVisibility(state: "visible" | "hidden") {
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    get: () => state,
  });
  document.dispatchEvent(new Event("visibilitychange"));
}

describe("useActivityStatus", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    setVisibility("visible");
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts active", () => {
    const { result } = renderHook(() => useActivityStatus(TIMEOUT));
    expect(result.current).toBe(true);
  });

  it("goes inactive after the timeout with no interaction", () => {
    const { result } = renderHook(() => useActivityStatus(TIMEOUT));
    act(() => {
      vi.advanceTimersByTime(TIMEOUT + 1);
    });
    expect(result.current).toBe(false);
  });

  it.each([
    "pointermove",
    "scroll",
    "keydown",
    "touchstart",
    "click",
  ])("resets the idle timer on %s", (eventName) => {
    const { result } = renderHook(() => useActivityStatus(TIMEOUT));
    act(() => {
      vi.advanceTimersByTime(TIMEOUT - 100);
    });
    act(() => {
      window.dispatchEvent(new Event(eventName));
    });
    act(() => {
      vi.advanceTimersByTime(TIMEOUT - 100);
    });
    expect(result.current).toBe(true);
  });

  it("resumes when the tab becomes visible again", () => {
    const { result } = renderHook(() => useActivityStatus(TIMEOUT));
    act(() => {
      vi.advanceTimersByTime(TIMEOUT + 1);
    });
    expect(result.current).toBe(false);
    act(() => {
      setVisibility("visible");
    });
    expect(result.current).toBe(true);
  });

  it("does not reset the timer when the tab is hidden", () => {
    const { result } = renderHook(() => useActivityStatus(TIMEOUT));
    act(() => {
      vi.advanceTimersByTime(TIMEOUT - 100);
    });
    act(() => {
      setVisibility("hidden");
    });
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(result.current).toBe(false);
  });

  it("removes listeners on unmount", () => {
    const remove = vi.spyOn(window, "removeEventListener");
    const { unmount } = renderHook(() => useActivityStatus(TIMEOUT));
    unmount();
    expect(remove).toHaveBeenCalled();
  });
});
