import type { ReactNode } from "react";
import { Header } from "./header";
import { SideRail } from "./side-rail";

export type AppShellProps = {
  firstName: string;
  children: ReactNode;
};

export function AppShell({ firstName, children }: AppShellProps) {
  return (
    <div className="flex min-h-svh flex-col md:flex-row">
      <SideRail firstName={firstName} className="hidden md:flex" />
      <Header firstName={firstName} className="md:hidden" />
      <main className="flex-1 min-w-0">{children}</main>
    </div>
  );
}
