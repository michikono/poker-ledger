import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { UseRealtimeRefreshParams } from "@/lib/realtime/use-realtime-refresh";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

const getClientDb = vi.fn(() => ({ _db: true }));
const getClientAuth = vi.fn(() => ({ _auth: true }));
vi.mock("@/lib/firebase/client", () => ({
  getClientDb: () => getClientDb(),
  getClientAuth: () => getClientAuth(),
}));

let authCallback: ((user: unknown) => void) | undefined;
const detachAuth = vi.fn();
const onAuthStateChanged = vi.fn(
  (_auth: unknown, cb: (user: unknown) => void) => {
    authCallback = cb;
    return detachAuth;
  },
);
vi.mock("firebase/auth", () => ({
  onAuthStateChanged: (auth: unknown, cb: (user: unknown) => void) =>
    onAuthStateChanged(auth, cb),
}));

const changeLogQuery = vi.fn(() => ({ _q: "changelog" }));
const sessionsIndexQuery = vi.fn(() => ({ _q: "sessions" }));
const innerUnsub = vi.fn();
const subscribeToChanges = vi.fn(() => innerUnsub);
vi.mock("@/lib/realtime/subscribe", () => ({
  changeLogQuery: (...a: unknown[]) => changeLogQuery(...(a as [])),
  sessionsIndexQuery: (...a: unknown[]) => sessionsIndexQuery(...(a as [])),
  subscribeToChanges: (...a: unknown[]) => subscribeToChanges(...(a as [])),
}));

const reconnect = vi.fn();
const captured: { params: UseRealtimeRefreshParams | undefined } = {
  params: undefined,
};
const useRealtimeRefresh = vi.fn((params: UseRealtimeRefreshParams) => {
  captured.params = params;
  return { status: "paused-idle" as const, reconnect };
});
vi.mock("@/lib/realtime/use-realtime-refresh", () => ({
  useRealtimeRefresh: (params: UseRealtimeRefreshParams) =>
    useRealtimeRefresh(params),
}));

import {
  RealtimeSyncProvider,
  useRealtimeStatus,
  useRealtimeSync,
} from "./realtime-sync-provider";

function StatusProbe() {
  return <span data-testid="probe">{useRealtimeStatus()}</span>;
}

function SyncProbe() {
  const { status, reconnect: r } = useRealtimeSync();
  return (
    <button type="button" data-testid="sync-probe" onClick={r}>
      {status}
    </button>
  );
}

describe("RealtimeSyncProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    captured.params = undefined;
    authCallback = undefined;
  });

  it("publishes the hook's status and reconnect to children via context", () => {
    render(
      <RealtimeSyncProvider target="index">
        <SyncProbe />
      </RealtimeSyncProvider>,
    );
    const probe = screen.getByTestId("sync-probe");
    expect(probe).toHaveTextContent("paused-idle");
    probe.click();
    expect(reconnect).toHaveBeenCalled();
  });

  it("keeps the legacy useRealtimeStatus hook working", () => {
    render(
      <RealtimeSyncProvider target="index">
        <StatusProbe />
      </RealtimeSyncProvider>,
    );
    expect(screen.getByTestId("probe")).toHaveTextContent("paused-idle");
  });

  it("does not attach a Firestore listener until auth yields a user", () => {
    render(
      <RealtimeSyncProvider target="session" sessionId="friday">
        <StatusProbe />
      </RealtimeSyncProvider>,
    );
    captured.params?.subscribe(
      () => {},
      () => {},
    );
    expect(onAuthStateChanged).toHaveBeenCalled();
    // No user yet.
    authCallback?.(null);
    expect(subscribeToChanges).not.toHaveBeenCalled();
    // Signed-in user arrives.
    authCallback?.({ uid: "u1" });
    expect(changeLogQuery).toHaveBeenCalledWith({ _db: true }, "friday");
    expect(subscribeToChanges).toHaveBeenCalledTimes(1);
  });

  it("wires the sessions index subscription once authed", () => {
    render(
      <RealtimeSyncProvider target="index">
        <StatusProbe />
      </RealtimeSyncProvider>,
    );
    captured.params?.subscribe(
      () => {},
      () => {},
    );
    authCallback?.({ uid: "u1" });
    expect(sessionsIndexQuery).toHaveBeenCalledWith({ _db: true });
    expect(subscribeToChanges).toHaveBeenCalledTimes(1);
  });

  it("re-attaches on sign-out then sign-in", () => {
    render(
      <RealtimeSyncProvider target="index">
        <StatusProbe />
      </RealtimeSyncProvider>,
    );
    captured.params?.subscribe(
      () => {},
      () => {},
    );
    authCallback?.({ uid: "u1" });
    expect(subscribeToChanges).toHaveBeenCalledTimes(1);
    authCallback?.(null); // sign-out tears down the inner listener
    expect(innerUnsub).toHaveBeenCalledTimes(1);
    authCallback?.({ uid: "u1" }); // sign-in re-attaches
    expect(subscribeToChanges).toHaveBeenCalledTimes(2);
  });

  it("tearing down removes the auth listener and the inner listener", () => {
    render(
      <RealtimeSyncProvider target="index">
        <StatusProbe />
      </RealtimeSyncProvider>,
    );
    const unsubscribe = captured.params?.subscribe(
      () => {},
      () => {},
    );
    authCallback?.({ uid: "u1" });
    unsubscribe?.();
    expect(detachAuth).toHaveBeenCalled();
    expect(innerUnsub).toHaveBeenCalled();
  });

  it("refreshes the router when onRefresh runs", () => {
    render(
      <RealtimeSyncProvider target="index">
        <StatusProbe />
      </RealtimeSyncProvider>,
    );
    captured.params?.onRefresh();
    expect(refresh).toHaveBeenCalled();
  });
});
