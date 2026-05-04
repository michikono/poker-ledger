import { NextResponse } from "next/server";
import { adminAuth } from "@/lib/auth/admin";
import { adminDb } from "@/lib/firebase/admin";
import type { SessionStatus } from "@/lib/sessions/types";

export type SearchResult = {
  name: string;
  status: SessionStatus;
  created_at: string;
  match_kind: "prefix" | "contains";
};

const MAX_RESULTS = 10;
const PREFIX_LIMIT = 5;
const CONTAINS_WINDOW = 100;

export async function GET(req: Request): Promise<Response> {
  const token = req.headers.get("Authorization")?.replace("Bearer ", "") ?? "";
  if (!token) {
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED" } },
      { status: 401 },
    );
  }
  try {
    await adminAuth.verifyIdToken(token);
  } catch {
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED" } },
      { status: 401 },
    );
  }

  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  if (!q) {
    return NextResponse.json(
      { error: { code: "INVALID_INPUT", message: "q is required" } },
      { status: 400 },
    );
  }

  const qLower = q.toLowerCase();

  const prefixSnap = await adminDb
    .collection("sessions")
    .where("name_lower", ">=", qLower)
    .where("name_lower", "<", `${qLower}`)
    .orderBy("name_lower")
    .limit(PREFIX_LIMIT)
    .get();

  const prefixIds = new Set<string>();
  const results: SearchResult[] = prefixSnap.docs.map((doc) => {
    prefixIds.add(doc.id);
    const data = doc.data();
    return {
      name: doc.id,
      status: data.status as SessionStatus,
      created_at: (data.created_at?.toDate?.() ?? new Date(0)).toISOString(),
      match_kind: "prefix",
    };
  });

  if (results.length < MAX_RESULTS) {
    const containsSnap = await adminDb
      .collection("sessions")
      .orderBy("created_at", "desc")
      .limit(CONTAINS_WINDOW)
      .get();

    for (const doc of containsSnap.docs) {
      if (results.length >= MAX_RESULTS) break;
      if (prefixIds.has(doc.id)) continue;
      const data = doc.data();
      const nameLower =
        typeof data.name_lower === "string"
          ? data.name_lower
          : doc.id.toLowerCase();
      if (!nameLower.includes(qLower)) continue;
      results.push({
        name: doc.id,
        status: data.status as SessionStatus,
        created_at: (data.created_at?.toDate?.() ?? new Date(0)).toISOString(),
        match_kind: "contains",
      });
    }
  }

  results.sort((a, b) => b.created_at.localeCompare(a.created_at));

  return NextResponse.json(results);
}
