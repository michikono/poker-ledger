"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { adminAuth } from "@/lib/auth/admin";
import { verifyIdToken } from "@/lib/auth/verify-token";

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
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_DURATION_S,
    path: "/",
  });
}

export async function signOut(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete("session");
  redirect("/sign-in");
}
