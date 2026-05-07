import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { getSessionUser } from "@/lib/auth/session-user";
import { fetchNavCounts } from "@/lib/sessions/queries";

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
