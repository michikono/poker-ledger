import { beforeEach, describe, expect, it, vi } from "vitest";

const verifyIdToken = vi.fn();

function makeDoc(
  id: string,
  data: { name_lower: string; status: string; created_at?: unknown },
) {
  return {
    id,
    data: () => ({
      ...data,
      created_at: data.created_at ?? {
        toDate: () => new Date("2026-01-01T00:00:00.000Z"),
      },
    }),
  };
}

function makeSnap(docs: ReturnType<typeof makeDoc>[]) {
  return { docs };
}

const getQueryMock = vi.fn();

const queryChain = {
  where: vi.fn().mockReturnThis(),
  orderBy: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  get: getQueryMock,
};

vi.mock("@/lib/auth/admin", () => ({
  adminAuth: { verifyIdToken: (...args: unknown[]) => verifyIdToken(...args) },
}));

vi.mock("@/lib/firebase/admin", () => ({
  adminDb: {
    collection: () => queryChain,
  },
}));

import { GET } from "./route";

function makeReq(q: string, token = "valid-token"): Request {
  const url = `http://localhost/api/sessions/search${q ? `?q=${encodeURIComponent(q)}` : ""}`;
  return new Request(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  verifyIdToken.mockResolvedValue({ uid: "user-1" });
  queryChain.where.mockReturnThis();
  queryChain.orderBy.mockReturnThis();
  queryChain.limit.mockReturnThis();
});

describe("GET /api/sessions/search", () => {
  describe("auth", () => {
    it("returns 401 when Authorization header is missing", async () => {
      const req = new Request("http://localhost/api/sessions/search?q=foo");
      const res = await GET(req);
      expect(res.status).toBe(401);
    });

    it("returns 401 when token verification throws", async () => {
      verifyIdToken.mockRejectedValue(new Error("bad token"));
      const res = await GET(makeReq("crispy", "bad-token"));
      expect(res.status).toBe(401);
    });

    it("verifies the ID token with checkRevoked=true", async () => {
      getQueryMock
        .mockResolvedValueOnce(makeSnap([]))
        .mockResolvedValueOnce(makeSnap([]));
      await GET(makeReq("crispy"));
      expect(verifyIdToken).toHaveBeenCalledWith("valid-token", true);
    });
  });

  describe("input validation", () => {
    it("returns 400 when q is missing", async () => {
      const req = new Request("http://localhost/api/sessions/search", {
        headers: { Authorization: "Bearer valid-token" },
      });
      const res = await GET(req);
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error.code).toBe("INVALID_INPUT");
    });

    it("returns 400 when q is empty string", async () => {
      const res = await GET(makeReq(""));
      expect(res.status).toBe(400);
    });

    it("returns 400 when q is only whitespace", async () => {
      const res = await GET(makeReq("   "));
      expect(res.status).toBe(400);
    });
  });

  describe("results", () => {
    it("returns empty array when no sessions match", async () => {
      getQueryMock
        .mockResolvedValueOnce(makeSnap([]))
        .mockResolvedValueOnce(makeSnap([]));
      const res = await GET(makeReq("xyz"));
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual([]);
    });

    it("returns prefix matches with match_kind=prefix", async () => {
      getQueryMock
        .mockResolvedValueOnce(
          makeSnap([
            makeDoc("crispy-salmon-001", {
              name_lower: "crispy-salmon-001",
              status: "in_progress",
            }),
          ]),
        )
        .mockResolvedValueOnce(makeSnap([]));
      const res = await GET(makeReq("crispy"));
      const data = await res.json();
      expect(data).toHaveLength(1);
      expect(data[0]).toMatchObject({
        name: "crispy-salmon-001",
        status: "in_progress",
        match_kind: "prefix",
      });
      expect(data[0].created_at).toBe("2026-01-01T00:00:00.000Z");
    });

    it("returns contains matches with match_kind=contains, excluding prefix results", async () => {
      const prefixDoc = makeDoc("crispy-salmon-001", {
        name_lower: "crispy-salmon-001",
        status: "in_progress",
      });
      const containsDoc = makeDoc("apple-crispy-002", {
        name_lower: "apple-crispy-002",
        status: "settled",
      });
      const nonMatchDoc = makeDoc("happy-tuna-003", {
        name_lower: "happy-tuna-003",
        status: "settling",
      });
      getQueryMock
        .mockResolvedValueOnce(makeSnap([prefixDoc]))
        .mockResolvedValueOnce(makeSnap([prefixDoc, containsDoc, nonMatchDoc]));
      const res = await GET(makeReq("crispy"));
      const data = await res.json();
      expect(data).toHaveLength(2);
      expect(data[0]).toMatchObject({
        name: "crispy-salmon-001",
        match_kind: "prefix",
      });
      expect(data[1]).toMatchObject({
        name: "apple-crispy-002",
        match_kind: "contains",
      });
    });

    it("does not exceed 10 results total", async () => {
      const prefixDocs = Array.from({ length: 5 }, (_, i) =>
        makeDoc(`prefix-${i}`, {
          name_lower: `prefix-${i}`,
          status: "settled",
        }),
      );
      const containsDocs = Array.from({ length: 20 }, (_, i) =>
        makeDoc(`foo-bar-${i}`, {
          name_lower: `foo-bar-${i}`,
          status: "settled",
        }),
      );
      getQueryMock
        .mockResolvedValueOnce(makeSnap(prefixDocs))
        .mockResolvedValueOnce(makeSnap(containsDocs));
      const res = await GET(makeReq("foo"));
      const data = await res.json();
      expect(data.length).toBeLessThanOrEqual(10);
    });

    it("runs contains query after prefix to fill remaining slots", async () => {
      const prefixDocs = Array.from({ length: 5 }, (_, i) =>
        makeDoc(`prefix-${i}`, {
          name_lower: `prefix-${i}`,
          status: "settled",
        }),
      );
      const containsDocs = Array.from({ length: 3 }, (_, i) =>
        makeDoc(`bar-${i}`, {
          name_lower: `bar-prefix-${i}`,
          status: "in_progress",
        }),
      );
      getQueryMock
        .mockResolvedValueOnce(makeSnap(prefixDocs))
        .mockResolvedValueOnce(makeSnap(containsDocs));
      const res = await GET(makeReq("prefix"));
      const data = await res.json();
      expect(getQueryMock).toHaveBeenCalledTimes(2);
      expect(data).toHaveLength(8); // 5 prefix + 3 contains
    });

    it("lowercases the query before matching", async () => {
      getQueryMock
        .mockResolvedValueOnce(makeSnap([]))
        .mockResolvedValueOnce(makeSnap([]));
      await GET(makeReq("CRISPY"));
      const firstWhereCall = queryChain.where.mock.calls[0];
      expect(firstWhereCall?.[2]).toBe("crispy");
    });
  });
});
