"use client";

import { MenuIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { CardIcon } from "@/components/icons/card-icon";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { NAV_ITEMS } from "./nav-items";
import { UserMenu } from "./user-menu";

export type HeaderProps = {
  firstName: string;
  className?: string;
};

export function Header({ firstName, className }: HeaderProps) {
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
        <SheetContent side="left" className="w-72 p-0">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <CardIcon size={24} />
              <span>Poker Ledger</span>
            </SheetTitle>
          </SheetHeader>
          <nav className="px-2 pb-4">
            <ul className="flex flex-col gap-0.5">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                return (
                  <li key={item.label}>
                    <Link
                      href={item.href}
                      onClick={() => setOpen(false)}
                      className="group flex items-center gap-2 rounded-md px-2 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                    >
                      <Icon className="size-4 text-felt" />
                      <span>{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        </SheetContent>
      </Sheet>
      <Link
        href="/sessions"
        className="flex items-center gap-2 font-heading font-semibold"
      >
        <CardIcon size={20} />
        <span>Poker Ledger</span>
      </Link>
      <UserMenu firstName={firstName} variant="header" />
    </header>
  );
}
