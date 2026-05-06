import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { adminAuth } from "@/lib/auth/admin";
import { SignInForm } from "./sign-in-form";

// Server component so we can cryptographically verify the session cookie
// before deciding whether to redirect an already-signed-in user.
//
// Doing this check here (instead of in `src/proxy.ts`) avoids a redirect loop:
// if the proxy redirected `/sign-in -> /sessions` based on cookie presence
// alone, an invalid-but-present cookie would bounce between
// `/sessions` (layout fails verification, redirects to `/sign-in`)
// and `/sign-in` (proxy sees the cookie, redirects to `/sessions`).
async function hasValidSession(): Promise<boolean> {
  const cookieStore = await cookies();
  const session = cookieStore.get("session")?.value;
  if (!session) return false;
  try {
    await adminAuth.verifySessionCookie(session, true);
    return true;
  } catch {
    return false;
  }
}

export default async function SignInPage() {
  if (await hasValidSession()) redirect("/sessions");
  return <SignInForm />;
}
