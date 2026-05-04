"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type NavLinkProps = {
  href: string;
  children: ReactNode;
  className?: string;
  onClick?: () => void;
};

export function NavLink({ href, children, className, onClick }: NavLinkProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const url = new URL(href, "http://n");
  const hrefStatus = url.searchParams.get("status");
  const currentStatus = searchParams.get("status");
  const isActive = pathname === url.pathname && currentStatus === hrefStatus;

  return (
    <Link
      href={href}
      {...(onClick ? { onClick } : {})}
      className={cn(
        "group flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
        isActive
          ? "bg-accent text-accent-foreground"
          : "text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
        className,
      )}
    >
      {children}
    </Link>
  );
}
