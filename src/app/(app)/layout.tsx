import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { getSessionUser } from "@/lib/auth/session-user";
import { fetchNavCounts } from "@/lib/sessions/queries";
import { CURRENT_URL_HEADER } from "@/proxy";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser();
  if (!user) {
    // Recover the original URL (path + search) from the header set by the
    // middleware so deep links like /sessions/abc?help=rules survive an
    // invalid-cookie redirect to /sign-in. Falls back to /sessions if the
    // header isn't present (e.g., a test that bypasses middleware).
    const headerList = await headers();
    const fullPath = headerList.get(CURRENT_URL_HEADER) ?? "/sessions";
    const search = new URLSearchParams({ from: fullPath }).toString();
    redirect(`/sign-in?${search}`);
  }

  const navCounts = await fetchNavCounts();

  return (
    <AppShell firstName={user.firstName} navCounts={navCounts}>
      {children}
    </AppShell>
  );
}
