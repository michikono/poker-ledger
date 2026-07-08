import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Unsubscribe } from "./subscribe";
import { useRealtimeRefresh } from "./use-realtime-refresh";

const IDLE = 1000;
const DEBOUNCE = 250;

type Harness = {
  emitChange: () => void;
  emitError: () => void;
  unsubscribe: ReturnType<typeof vi.fn>;
  subscribeCount: () => number;
};

function makeSubscribe(): {
  subscribe: (onChange: () => void, onError: (e: Error) => void) => Unsubscribe;
  harness: Harness;
} {
  let onChange: () => void = () => {};
  let onError: (e: Error) => void = () => {};
  let count = 0;
  const unsubscribe = vi.fn();
  const subscribe = (c: () => void, e: (err: Error) => void): Unsubscribe => {
    count += 1;
    onChange = c;
    onError = e;
    return unsubscribe;
  };
  return {
    subscribe,
    harness: {
      emitChange: () => onChange(),
      emitError: () => onError(new Error("boom")),
      unsubscribe,
      subscribeCount: () => count,
    },
  };
}

function setOnline(value: boolean) {
  Object.defineProperty(navigator, "onLine", {
    configurable: true,
    get: () => value,
  });
  window.dispatchEvent(new Event(value ? "online" : "offline"));
}

describe("useRealtimeRefresh", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    setOnline(true);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("subscribes while active but does not refresh on initial mount", () => {
    const { subscribe, harness } = makeSubscribe();
    const onRefresh = vi.fn();
    const { result } = renderHook(() =>
      useRealtimeRefresh({
        subscribe,
        onRefresh,
        idleTimeoutMs: IDLE,
        debounceMs: DEBOUNCE,
      }),
    );
    expect(harness.subscribeCount()).toBe(1);
    expect(onRefresh).not.toHaveBeenCalled();
    expect(result.current.status).toBe("live");
  });

  it("refreshes once (debounced) on a burst of changes", () => {
    const { subscribe, harness } = makeSubscribe();
    const onRefresh = vi.fn();
    renderHook(() =>
      useRealtimeRefresh({
        subscribe,
        onRefresh,
        idleTimeoutMs: IDLE,
        debounceMs: DEBOUNCE,
      }),
    );
    act(() => {
      harness.emitChange();
      harness.emitChange();
      harness.emitChange();
    });
    expect(onRefresh).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(DEBOUNCE + 1);
    });
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it("unsubscribes when idle and ignores later changes", () => {
    const { subscribe, harness } = makeSubscribe();
    const onRefresh = vi.fn();
    const { result } = renderHook(() =>
      useRealtimeRefresh({
        subscribe,
        onRefresh,
        idleTimeoutMs: IDLE,
        debounceMs: DEBOUNCE,
      }),
    );
    act(() => {
      vi.advanceTimersByTime(IDLE + 1);
    });
    expect(harness.unsubscribe).toHaveBeenCalled();
    expect(result.current.status).toBe("paused-idle");
  });

  it("resubscribes and does one catch-up refresh on reactivation", () => {
    const { subscribe, harness } = makeSubscribe();
    const onRefresh = vi.fn();
    const { result } = renderHook(() =>
      useRealtimeRefresh({
        subscribe,
        onRefresh,
        idleTimeoutMs: IDLE,
        debounceMs: DEBOUNCE,
      }),
    );
    act(() => {
      vi.advanceTimersByTime(IDLE + 1);
    });
    expect(result.current.status).toBe("paused-idle");
    act(() => {
      window.dispatchEvent(new Event("pointermove"));
    });
    expect(result.current.status).toBe("live");
    expect(onRefresh).toHaveBeenCalledTimes(1);
    expect(harness.subscribeCount()).toBe(2);
  });

  it("reports offline when the network drops", () => {
    const { subscribe } = makeSubscribe();
    const { result } = renderHook(() =>
      useRealtimeRefresh({
        subscribe,
        onRefresh: vi.fn(),
        idleTimeoutMs: IDLE,
        debounceMs: DEBOUNCE,
      }),
    );
    act(() => {
      setOnline(false);
    });
    expect(result.current.status).toBe("offline");
  });

  it("reports offline when the listener errors", () => {
    const { subscribe, harness } = makeSubscribe();
    const { result } = renderHook(() =>
      useRealtimeRefresh({
        subscribe,
        onRefresh: vi.fn(),
        idleTimeoutMs: IDLE,
        debounceMs: DEBOUNCE,
      }),
    );
    act(() => {
      harness.emitError();
    });
    expect(result.current.status).toBe("offline");
  });
});
