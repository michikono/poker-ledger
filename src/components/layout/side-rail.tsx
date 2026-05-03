import Link from "next/link";
import { CardIcon } from "@/components/icons/card-icon";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { UserMenu } from "./user-menu";
import { NAV_ITEMS } from "./nav-items";

export type SideRailProps = {
  firstName: string;
  className?: string;
};

export function SideRail({ firstName, className }: SideRailProps) {
  return (
    <aside
      className={cn(
        "w-60 shrink-0 flex-col border-r border-border bg-sidebar text-sidebar-foreground",
        className,
      )}
    >
      <div className="flex items-center gap-2 px-4 py-5">
        <CardIcon size={28} />
        <span className="font-heading text-lg font-semibold tracking-tight">
          Poker Ledger
        </span>
      </div>
      <Separator />
      <nav className="flex-1 overflow-y-auto px-2 py-3">
        <ul className="flex flex-col gap-0.5">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.label}>
                <Link
                  href={item.href}
                  className="group flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                >
                  <Icon className="size-4 text-felt group-hover:text-felt" />
                  <span>{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <Separator />
      <div className="px-2 py-3">
        <UserMenu firstName={firstName} variant="rail" />
      </div>
    </aside>
  );
}
