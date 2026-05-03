import {
  ArchiveIcon,
  CheckIcon,
  CircleDotIcon,
  HourglassIcon,
  PlusIcon,
  SearchIcon,
} from "lucide-react";
import type { ComponentType, SVGProps } from "react";

export type NavItem = {
  label: string;
  href: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
};

export const NAV_ITEMS: readonly NavItem[] = [
  { label: "Search", href: "/sessions?focus=search", icon: SearchIcon },
  { label: "New session", href: "/sessions", icon: PlusIcon },
  {
    label: "In progress",
    href: "/sessions?status=in_progress",
    icon: CircleDotIcon,
  },
  { label: "Settling", href: "/sessions?status=settling", icon: HourglassIcon },
  { label: "Settled", href: "/sessions?status=settled", icon: CheckIcon },
  { label: "Archived", href: "/sessions?status=archived", icon: ArchiveIcon },
];
