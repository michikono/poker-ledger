import { getClientAuth } from "@/lib/firebase/client";

export async function getToken(): Promise<string | null> {
  try {
    const auth = getClientAuth();
    await auth.authStateReady();
    return (await auth.currentUser?.getIdToken()) ?? null;
  } catch {
    return null;
  }
}

export function redirectToSignIn(): void {
  if (typeof window !== "undefined") {
    // Preserve both pathname and search so deep links (e.g.
    // /sessions/abc?help=rules) survive a server-action-triggered
    // sign-in round-trip.
    const fullPath = `${window.location.pathname}${window.location.search}`;
    window.location.href = `/sign-in?from=${encodeURIComponent(fullPath)}`;
  }
}

export async function withToken<T>(
  fn: (token: string) => Promise<T>,
): Promise<T | null> {
  const token = await getToken();
  if (!token) {
    redirectToSignIn();
    return null;
  }
  return await fn(token);
}
