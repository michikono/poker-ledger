import { cookies } from "next/headers";
import { adminAuth } from "@/lib/auth/admin";

export type SessionUser = {
  uid: string;
  firstName: string;
};

export async function getSessionUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const session = cookieStore.get("session")?.value;
  if (!session) return null;
  try {
    const decoded = await adminAuth.verifySessionCookie(session, true);
    const displayName = decoded.name ?? decoded.email ?? "User";
    const firstName = displayName.split(" ")[0] ?? displayName;
    return { uid: decoded.uid, firstName };
  } catch {
    return null;
  }
}
