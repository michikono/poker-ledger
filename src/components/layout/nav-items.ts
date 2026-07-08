import {
  ArchiveIcon,
  CheckIcon,
  CircleDotIcon,
  HourglassIcon,
  ListIcon,
} from "lucide-react";
import type { ComponentType, SVGProps } from "react";

export type NavItem = {
  label: string;
  href: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  countKey?: "in_progress" | "settling";
};

export const NAV_ITEMS: readonly NavItem[] = [
  {
    label: "All sessions",
    href: "/sessions?status=all",
    icon: ListIcon,
  },
  {
    label: "In Progress",
    href: "/sessions?status=in_progress",
    icon: CircleDotIcon,
    countKey: "in_progress",
  },
  {
    label: "Settling",
    href: "/sessions?status=settling",
    icon: HourglassIcon,
    countKey: "settling",
  },
  {
    label: "Settled",
    href: "/sessions?status=settled",
    icon: CheckIcon,
  },
  {
    label: "Archived",
    href: "/sessions?status=archived",
    icon: ArchiveIcon,
  },
];
