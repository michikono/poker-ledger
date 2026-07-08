"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { adminAuth } from "@/lib/auth/admin";
import { verifyIdToken } from "@/lib/auth/verify-token";
import { archiveStaleSessionsOnLogin } from "@/lib/sessions/garbage-collect";

const SESSION_DURATION_MS = 60 * 60 * 24 * 5 * 1000; // 5 days
const SESSION_DURATION_S = 60 * 60 * 24 * 5;

export async function createSession(idToken: string): Promise<void> {
  await verifyIdToken(idToken); // throws if invalid
  const sessionCookie = await adminAuth.createSessionCookie(idToken, {
    expiresIn: SESSION_DURATION_MS,
  });
  const cookieStore = await cookies();
  cookieStore.set("session", sessionCookie, {
    httpOnly: true,
    // Lax (not Strict) so the cookie survives the cross-site top-level
    // navigation returning from the Google OAuth redirect flow. Strict would
    // withhold it on that first request and bounce the user back to /sign-in.
    // Safe: Lax is still withheld from cross-site POST, and mutations require a
    // fresh ID token in addition to this cookie (docs/03).
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_DURATION_S,
    path: "/",
  });
  await archiveStaleSessionsOnLogin();
}

export async function signOut(): Promise<void> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("session")?.value;
  if (sessionCookie) {
    try {
      const decoded = await adminAuth.verifySessionCookie(sessionCookie, true);
      await adminAuth.revokeRefreshTokens(decoded.uid);
    } catch (err) {
      // Sign-out must always complete from the user's perspective, even if the
      // session cookie is already invalid or the Admin SDK fails. Log and proceed.
      console.error("signOut: refresh-token revocation failed", err);
    }
  }
  cookieStore.delete("session");
  redirect("/sign-in");
}
