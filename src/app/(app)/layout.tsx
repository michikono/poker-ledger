import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { adminAuth } from "@/lib/auth/admin";
import { fetchNavCounts } from "@/lib/sessions/queries";

async function getSessionUser() {
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

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/sign-in");

  const navCounts = await fetchNavCounts();

  return (
    <AppShell firstName={user.firstName} navCounts={navCounts}>
      {children}
    </AppShell>
  );
}
