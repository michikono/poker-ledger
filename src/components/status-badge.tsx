import { Badge } from "@/components/ui/badge";
import { formatStatus } from "@/lib/sessions/format-status";
import type { SessionStatus } from "@/lib/sessions/types";

const STATUS_CLASSES: Record<SessionStatus, string> = {
  in_progress:
    "bg-status-in-progress/15 text-status-in-progress-fg border-status-in-progress/30",
  settling:
    "bg-status-settling/20 text-status-settling-fg border-status-settling/40",
  settled:
    "bg-status-settled/15 text-status-settled-fg border-status-settled/30",
  archived:
    "bg-status-archived/10 text-status-archived-fg border-status-archived/30 border-dashed",
};

export function StatusBadge({ status }: { status: SessionStatus }) {
  return (
    <Badge variant="outline" className={STATUS_CLASSES[status]}>
      {formatStatus(status)}
    </Badge>
  );
}
