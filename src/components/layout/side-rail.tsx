import Link from "next/link";
import { Suspense } from "react";
import { CardIcon } from "@/components/icons/card-icon";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type { NavCounts } from "@/lib/sessions/queries";
import { NavLink } from "./nav-link";
import { NavSearch } from "./nav-search";
import { NewSessionButton } from "./new-session-button";
import { NAV_ITEMS } from "./nav-items";
import { UserMenu } from "./user-menu";

export type SideRailProps = {
  firstName: string;
  navCounts: NavCounts;
  className?: string;
};

export function SideRail({ firstName, navCounts, className }: SideRailProps) {
  return (
    <aside
      className={cn(
        "w-60 shrink-0 flex-col border-r border-border bg-sidebar text-sidebar-foreground",
        className,
      )}
    >
      {/* Logo */}
      <Link
        href="/sessions"
        className="flex items-center gap-2 px-4 py-5 transition-opacity hover:opacity-80"
      >
        <CardIcon size={28} />
        <span className="font-heading text-lg font-semibold tracking-tight">
          Poker Ledger
        </span>
      </Link>

      <Separator />

      <div className="flex flex-1 flex-col overflow-y-auto">
        {/* Zone 1: New session CTA */}
        <div className="px-2 pt-3 pb-2">
          <NewSessionButton />
        </div>

        {/* Zone 2: Search */}
        <div className="pb-3">
          <NavSearch />
        </div>

        <Separator />

        {/* Zone 3: Status filters */}
        <nav className="flex-1 px-2 py-3">
          <ul className="flex flex-col gap-0.5">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const count = item.countKey
                ? navCounts[item.countKey]
                : undefined;
              return (
                <li key={item.label}>
                  <Suspense
                    fallback={
                      <Link
                        href={item.href}
                        className="group flex min-h-11 items-center gap-2 rounded-md px-3 py-2 text-base text-sidebar-foreground/75 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground md:min-h-0 md:px-2 md:py-1.5 md:text-sm"
                      >
                        <Icon className="size-4 text-sidebar-foreground/60" />
                        <span className="flex-1">{item.label}</span>
                        {count != null && count > 0 && (
                          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-sidebar-foreground/15 px-1.5 text-xs font-medium text-sidebar-foreground tabular-nums">
                            {count}
                          </span>
                        )}
                      </Link>
                    }
                  >
                    <NavLink href={item.href}>
                      <Icon className="size-4 text-sidebar-foreground/60" />
                      <span className="flex-1">{item.label}</span>
                      {count != null && count > 0 && (
                        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-sidebar-foreground/15 px-1.5 text-xs font-medium text-sidebar-foreground tabular-nums">
                          {count}
                        </span>
                      )}
                    </NavLink>
                  </Suspense>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>

      <Separator />

      {/* Zone 4: User account */}
      <UserMenu firstName={firstName} />
    </aside>
  );
}
