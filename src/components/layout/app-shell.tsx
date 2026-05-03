import type { ReactNode } from "react";
import type { NavCounts } from "@/lib/sessions/queries";
import { Header } from "./header";
import { SideRail } from "./side-rail";

export type AppShellProps = {
  firstName: string;
  navCounts: NavCounts;
  children: ReactNode;
};

export function AppShell({ firstName, navCounts, children }: AppShellProps) {
  return (
    <div className="flex min-h-svh flex-col md:flex-row">
      <SideRail
        firstName={firstName}
        navCounts={navCounts}
        className="hidden md:flex md:sticky md:top-0 md:h-svh"
      />
      <Header
        firstName={firstName}
        navCounts={navCounts}
        className="md:hidden"
      />
      <main className="flex-1 min-w-0">{children}</main>
    </div>
  );
}
