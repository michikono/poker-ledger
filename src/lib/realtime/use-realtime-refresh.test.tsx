import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SubscribeHandlers, Unsubscribe } from "./subscribe";
import { useRealtimeRefresh } from "./use-realtime-refresh";

const IDLE = 1000;
const DEBOUNCE = 250;

type Harness = {
  // A snapshot with no change (e.g. the initial snapshot of a re-attached
  // listener): health signal only, mirrors subscribeToChanges' onSnapshot.
  emitSnapshot: () => void;
  // A real change: fires onSnapshot then onChange, as subscribeToChanges does.
  emitChange: () => void;
  emitError: () => void;
  unsubscribe: ReturnType<typeof vi.fn>;
  subscribeCount: () => number;
};

function makeSubscribe(): {
  subscribe: (handlers: SubscribeHandlers) => Unsubscribe;
  harness: Harness;
} {
  let handlers: SubscribeHandlers = {
    onSnapshot: () => {},
    onChange: () => {},
  };
  let count = 0;
  const unsubscribe = vi.fn();
  const subscribe = (h: SubscribeHandlers): Unsubscribe => {
    count += 1;
    handlers = h;
    return unsubscribe;
  };
  return {
    subscribe,
    harness: {
      emitSnapshot: () => handlers.onSnapshot(),
      emitChange: () => {
        handlers.onSnapshot();
        handlers.onChange();
      },
      emitError: () => handlers.onError?.(new Error("boom")),
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

  it("logs the listener error so the failure is diagnosable", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { subscribe, harness } = makeSubscribe();
    renderHook(() =>
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
    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining("Firestore listener error"),
      expect.any(Error),
    );
    spy.mockRestore();
  });

  it("auto-retries after a terminal listener error", () => {
    const { subscribe, harness } = makeSubscribe();
    // Idle window longer than the 5s retry so the retry isn't masked by idle.
    const { result } = renderHook(() =>
      useRealtimeRefresh({
        subscribe,
        onRefresh: vi.fn(),
        idleTimeoutMs: 60_000,
        debounceMs: DEBOUNCE,
      }),
    );
    expect(harness.subscribeCount()).toBe(1);
    act(() => {
      harness.emitError();
    });
    expect(result.current.status).toBe("offline");
    act(() => {
      vi.advanceTimersByTime(5000 + 1);
    });
    expect(harness.subscribeCount()).toBe(2);
    expect(result.current.status).toBe("live");
  });

  it("returns to live when any snapshot arrives after an error", () => {
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
    // The stuck-red regression: a listener re-attached by the auth-gated
    // provider delivers only its *initial* snapshot (a health signal, no
    // onChange) without a re-subscribe. That alone must clear the stale error.
    act(() => {
      harness.emitSnapshot();
    });
    expect(result.current.status).toBe("live");
    expect(harness.subscribeCount()).toBe(1);
  });

  it("cancels the pending auto-retry once a snapshot recovers the listener", () => {
    const { subscribe, harness } = makeSubscribe();
    const { result } = renderHook(() =>
      useRealtimeRefresh({
        subscribe,
        onRefresh: vi.fn(),
        idleTimeoutMs: 60_000,
        debounceMs: DEBOUNCE,
      }),
    );
    act(() => {
      harness.emitError();
    });
    expect(result.current.status).toBe("offline");
    act(() => {
      harness.emitSnapshot();
    });
    expect(result.current.status).toBe("live");
    // The recovered listener stays attached: the 5s retry must not re-subscribe.
    act(() => {
      vi.advanceTimersByTime(5000 + 1);
    });
    expect(harness.subscribeCount()).toBe(1);
    expect(result.current.status).toBe("live");
  });

  it("reconnect() resubscribes immediately and does one catch-up refresh", () => {
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
      harness.emitError();
    });
    expect(result.current.status).toBe("offline");
    onRefresh.mockClear();
    act(() => {
      result.current.reconnect();
    });
    expect(harness.subscribeCount()).toBe(2);
    expect(onRefresh).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe("live");
  });
});
