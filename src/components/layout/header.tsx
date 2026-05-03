"use client";

import { MenuIcon } from "lucide-react";
import Link from "next/link";
import { Suspense, useState } from "react";
import { CardIcon } from "@/components/icons/card-icon";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import type { NavCounts } from "@/lib/sessions/queries";
import { NavLink } from "./nav-link";
import { NavSearch } from "./nav-search";
import { NewSessionButton } from "./new-session-button";
import { NAV_ITEMS } from "./nav-items";
import { UserMenu } from "./user-menu";

export type HeaderProps = {
  firstName: string;
  navCounts: NavCounts;
  className?: string;
};

export function Header({ firstName, navCounts, className }: HeaderProps) {
  const [open, setOpen] = useState(false);

  return (
    <header
      className={cn(
        "flex items-center justify-between gap-2 border-b border-border bg-background px-3 py-2",
        className,
      )}
    >
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger
          render={<Button variant="ghost" size="icon" aria-label="Open menu" />}
        >
          <MenuIcon className="size-5" />
        </SheetTrigger>
        <SheetContent side="left" className="flex w-72 flex-col p-0">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <CardIcon size={24} />
              <span>Poker Ledger</span>
            </SheetTitle>
          </SheetHeader>

          <div className="flex flex-1 flex-col overflow-y-auto">
            {/* Zone 1: New session CTA */}
            <div className="px-2 pt-1 pb-2">
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
                            onClick={() => setOpen(false)}
                            className="group flex items-center gap-2 rounded-md px-2 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                          >
                            <Icon className="size-4 text-felt" />
                            <span className="flex-1">{item.label}</span>
                            {count != null && count > 0 && (
                              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-felt/15 px-1.5 text-xs font-medium text-felt tabular-nums">
                                {count}
                              </span>
                            )}
                          </Link>
                        }
                      >
                        <NavLink
                          href={item.href}
                          onClick={() => setOpen(false)}
                          className="py-2"
                        >
                          <Icon className="size-4 text-felt" />
                          <span className="flex-1">{item.label}</span>
                          {count != null && count > 0 && (
                            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-felt/15 px-1.5 text-xs font-medium text-felt tabular-nums">
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
        </SheetContent>
      </Sheet>

      <Link
        href="/sessions"
        className="flex items-center gap-2 font-heading font-semibold"
      >
        <CardIcon size={20} />
        <span>Poker Ledger</span>
      </Link>

      <UserMenu firstName={firstName} />
    </header>
  );
}
