import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { UseRealtimeRefreshParams } from "@/lib/realtime/use-realtime-refresh";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

const getClientDb = vi.fn(() => ({ _db: true }));
vi.mock("@/lib/firebase/client", () => ({
  getClientDb: () => getClientDb(),
}));

const changeLogQuery = vi.fn(() => ({ _q: "changelog" }));
const sessionsIndexQuery = vi.fn(() => ({ _q: "sessions" }));
const subscribeToChanges = vi.fn(() => () => {});
vi.mock("@/lib/realtime/subscribe", () => ({
  changeLogQuery: (...a: unknown[]) => changeLogQuery(...(a as [])),
  sessionsIndexQuery: (...a: unknown[]) => sessionsIndexQuery(...(a as [])),
  subscribeToChanges: (...a: unknown[]) => subscribeToChanges(...(a as [])),
}));

const captured: { params: UseRealtimeRefreshParams | undefined } = {
  params: undefined,
};
const useRealtimeRefresh = vi.fn((params: UseRealtimeRefreshParams) => {
  captured.params = params;
  return { status: "paused-idle" as const };
});
vi.mock("@/lib/realtime/use-realtime-refresh", () => ({
  useRealtimeRefresh: (params: UseRealtimeRefreshParams) =>
    useRealtimeRefresh(params),
}));

import {
  RealtimeSyncProvider,
  useRealtimeStatus,
} from "./realtime-sync-provider";

function StatusProbe() {
  return <span data-testid="probe">{useRealtimeStatus()}</span>;
}

describe("RealtimeSyncProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    captured.params = undefined;
  });

  it("publishes the hook's status to children via context", () => {
    render(
      <RealtimeSyncProvider target="index">
        <StatusProbe />
      </RealtimeSyncProvider>,
    );
    expect(screen.getByTestId("probe")).toHaveTextContent("paused-idle");
  });

  it("wires a session change_log subscription", () => {
    render(
      <RealtimeSyncProvider target="session" sessionId="friday">
        <StatusProbe />
      </RealtimeSyncProvider>,
    );
    captured.params?.subscribe(
      () => {},
      () => {},
    );
    expect(getClientDb).toHaveBeenCalled();
    expect(changeLogQuery).toHaveBeenCalledWith({ _db: true }, "friday");
    expect(subscribeToChanges).toHaveBeenCalled();
  });

  it("wires the sessions index subscription", () => {
    render(
      <RealtimeSyncProvider target="index">
        <StatusProbe />
      </RealtimeSyncProvider>,
    );
    captured.params?.subscribe(
      () => {},
      () => {},
    );
    expect(sessionsIndexQuery).toHaveBeenCalledWith({ _db: true });
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
