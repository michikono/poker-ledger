import Link from "next/link";
import { cn } from "@/lib/utils";
import { STATUS_LABELS, type SessionStatus } from "@/lib/sessions/types";

const PILL_STATUSES: readonly SessionStatus[] = [
  "in_progress",
  "settling",
  "settled",
  "archived",
];

export function FilterPills({
  activeFilter,
}: {
  activeFilter?: SessionStatus;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {PILL_STATUSES.map((status) => {
        const isActive = status === activeFilter;
        return (
          <Link
            key={status}
            href={isActive ? "/sessions" : `/sessions?status=${status}`}
            className={cn(
              "rounded-full border px-3 py-1 text-sm font-medium transition-colors",
              isActive
                ? "border-accent bg-accent text-accent-foreground"
                : "border-border text-muted-foreground hover:bg-accent hover:text-accent-foreground",
            )}
          >
            {STATUS_LABELS[status]}
          </Link>
        );
      })}
    </div>
  );
}
