import type { ReactNode } from "react";
import type { NavCounts } from "@/lib/sessions/queries";
import { Header } from "./header";
import { HelpButtons, HELP_ENABLED } from "./help-buttons";
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
      <div className="flex min-w-0 flex-1 flex-col">
        {HELP_ENABLED && (
          <div
            data-slot="app-top-bar"
            className="hidden h-12 items-center justify-end gap-1 border-b border-border bg-background px-3 md:flex"
          >
            <HelpButtons />
          </div>
        )}
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
