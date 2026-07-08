import Link from "next/link";
import { cn } from "@/lib/utils";
import { STATUS_LABELS, type SessionStatus } from "@/lib/sessions/types";

const PILL_STATUSES: readonly SessionStatus[] = [
  "in_progress",
  "settling",
  "settled",
  "archived",
];

function pillClass(isActive: boolean) {
  return cn(
    "inline-flex min-h-11 items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-medium transition-colors md:min-h-0 md:px-3 md:py-1",
    isActive
      ? "border-accent bg-accent text-accent-foreground"
      : "border-border text-muted-foreground hover:bg-accent hover:text-accent-foreground",
  );
}

export function FilterPills({
  activeFilter,
  counts,
}: {
  activeFilter?: SessionStatus;
  counts?: { in_progress: number; settling: number };
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <Link href="/sessions?status=all" className={pillClass(!activeFilter)}>
        All
      </Link>
      {PILL_STATUSES.map((status) => {
        const isActive = status === activeFilter;
        const count =
          counts && (status === "in_progress" || status === "settling")
            ? counts[status]
            : undefined;
        return (
          <Link
            key={status}
            href={
              isActive ? "/sessions?status=all" : `/sessions?status=${status}`
            }
            className={pillClass(isActive)}
          >
            {STATUS_LABELS[status]}
            {count != null && count > 0 && (
              <span
                aria-hidden="true"
                className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-felt/15 px-1.5 text-xs font-medium text-felt tabular-nums"
              >
                {count}
              </span>
            )}
          </Link>
        );
      })}
    </div>
  );
}
