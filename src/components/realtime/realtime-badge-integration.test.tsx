import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Real hook + real badge; only Firebase is mocked at the boundary. This is the
// integration the unit tests miss (the provider test stubs the hook), so it is
// where a "badge shows red while updates flow" state bug would surface.

const refresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

vi.mock("@/lib/firebase/client", () => ({
  getClientDb: () => ({ _db: true }),
  getClientAuth: () => ({ _auth: true }),
}));

let authCallback: ((user: unknown) => void) | undefined;
vi.mock("firebase/auth", () => ({
  onAuthStateChanged: (_auth: unknown, cb: (user: unknown) => void) => {
    authCallback = cb;
    return () => {};
  },
}));

let emitNext: ((snap: unknown) => void) | undefined;
let emitError: ((e: Error) => void) | undefined;
vi.mock("firebase/firestore", () => ({
  collection: (...a: unknown[]) => ({ _c: a }),
  query: (...a: unknown[]) => ({ _q: a }),
  orderBy: (...a: unknown[]) => ({ _o: a }),
  limit: (n: number) => ({ _l: n }),
  onSnapshot: (
    _q: unknown,
    next: (snap: unknown) => void,
    error: (e: Error) => void,
  ) => {
    emitNext = next;
    emitError = error;
    return () => {};
  },
}));

import { ConnectionStatusLight } from "./connection-status-light";
import { RealtimeSyncProvider } from "./realtime-sync-provider";

function dotClass(): string {
  const trigger = screen.getByTestId("connection-status-light");
  const span = trigger.querySelector("span");
  return span?.getAttribute("class") ?? "";
}

function isGreen(): boolean {
  return dotClass().includes("bg-emerald-500");
}

describe("connection badge integration (real hook + real light)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authCallback = undefined;
    emitNext = undefined;
    emitError = undefined;
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows green while live updates are flowing", () => {
    render(
      <RealtimeSyncProvider target="index">
        <ConnectionStatusLight />
      </RealtimeSyncProvider>,
    );

    // Auth resolves a user; the Firestore listener attaches.
    act(() => {
      authCallback?.({ uid: "u1" });
    });
    // Initial snapshot arrives.
    act(() => {
      emitNext?.({});
    });
    expect(isGreen()).toBe(true);

    // A cross-client change arrives — the live-update feature "working".
    act(() => {
      emitNext?.({});
    });
    expect(refresh).not.toHaveBeenCalled(); // debounced, but health is live now
    expect(isGreen()).toBe(true);
  });

  it("stays green across a listener error that a later snapshot recovers", () => {
    render(
      <RealtimeSyncProvider target="index">
        <ConnectionStatusLight />
      </RealtimeSyncProvider>,
    );
    act(() => {
      authCallback?.({ uid: "u1" });
      emitNext?.({});
    });
    expect(isGreen()).toBe(true);
    act(() => {
      emitError?.(new Error("transient"));
    });
    expect(isGreen()).toBe(false);
    act(() => {
      emitNext?.({});
    });
    expect(isGreen()).toBe(true);
  });
});
