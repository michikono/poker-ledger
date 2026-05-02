import { Badge } from "@/components/ui/badge";
import type { SessionStatus } from "@/lib/sessions/types";

const STATUS_LABELS: Record<SessionStatus, string> = {
  in_progress: "In Progress",
  settling: "Settling",
  settled: "Settled",
  archived: "Archived",
};

const STATUS_CLASSES: Record<SessionStatus, string> = {
  in_progress:
    "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-100",
  settling:
    "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-100",
  settled: "bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-100",
  archived: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
};

export function StatusBadge({ status }: { status: SessionStatus }) {
  return (
    <Badge className={STATUS_CLASSES[status]}>{STATUS_LABELS[status]}</Badge>
  );
}
