import { adminAuth } from "./admin";

export async function verifyIdToken(
  token: string,
): Promise<{ uid: string; firstName: string }> {
  const decoded = await adminAuth.verifyIdToken(token, true);
  const displayName = decoded.name ?? decoded.email ?? "User";
  const firstName = displayName.split(" ")[0] ?? displayName;
  return { uid: decoded.uid, firstName };
}
