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
    window.location.href = `/sign-in?from=${encodeURIComponent(window.location.pathname)}`;
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
