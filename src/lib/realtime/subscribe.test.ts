import type { Firestore, Query } from "firebase/firestore";
import { beforeEach, describe, expect, it, vi } from "vitest";

const collection = vi.fn((...args: unknown[]) => ({ _collection: args }));
const query = vi.fn((...args: unknown[]) => ({ _query: args }) as unknown);
const orderBy = vi.fn((...args: unknown[]) => ({ _orderBy: args }));
const limit = vi.fn((n: number) => ({ _limit: n }));
const onSnapshot =
  vi.fn<
    (
      q: unknown,
      next: (snap: unknown) => void,
      error: (e: Error) => void,
    ) => () => void
  >();

vi.mock("firebase/firestore", () => ({
  collection: (...args: unknown[]) => collection(...args),
  query: (...args: unknown[]) => query(...args),
  orderBy: (...args: unknown[]) => orderBy(...args),
  limit: (n: number) => limit(n),
  onSnapshot: (q: unknown, next: unknown, error: unknown) =>
    onSnapshot(q, next as never, error as never),
}));

import {
  changeLogQuery,
  sessionsIndexQuery,
  subscribeToChanges,
} from "./subscribe";

const db = {} as Firestore;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("changeLogQuery", () => {
  it("targets the session's change_log, newest-first, limit 1", () => {
    changeLogQuery(db, "friday-game");
    expect(collection).toHaveBeenCalledWith(
      db,
      "sessions",
      "friday-game",
      "change_log",
    );
    expect(orderBy).toHaveBeenCalledWith("created_at", "desc");
    expect(limit).toHaveBeenCalledWith(1);
  });
});

describe("sessionsIndexQuery", () => {
  it("targets the top-level sessions collection, newest-first, limit 200", () => {
    sessionsIndexQuery(db);
    expect(collection).toHaveBeenCalledWith(db, "sessions");
    expect(orderBy).toHaveBeenCalledWith("created_at", "desc");
    expect(limit).toHaveBeenCalledWith(200);
  });
});

describe("subscribeToChanges", () => {
  it("skips the initial snapshot and fires onChange on later ones", () => {
    let emit: (snap: unknown) => void = () => {};
    onSnapshot.mockImplementation((_q, next) => {
      emit = next;
      return () => {};
    });
    const onChange = vi.fn();

    subscribeToChanges({} as Query, onChange);
    emit({}); // initial — ignored
    expect(onChange).not.toHaveBeenCalled();
    emit({}); // real change
    emit({}); // another
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it("forwards errors to onError", () => {
    let fail: (e: Error) => void = () => {};
    onSnapshot.mockImplementation((_q, _next, error) => {
      fail = error;
      return () => {};
    });
    const onError = vi.fn();

    subscribeToChanges({} as Query, vi.fn(), onError);
    const err = new Error("permission-denied");
    fail(err);
    expect(onError).toHaveBeenCalledWith(err);
  });

  it("returns the unsubscribe from onSnapshot", () => {
    const unsub = vi.fn();
    onSnapshot.mockReturnValue(unsub);
    expect(subscribeToChanges({} as Query, vi.fn())).toBe(unsub);
  });
});
