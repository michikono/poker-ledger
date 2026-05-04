import Link from "next/link";
import { StatusBadge } from "@/components/status-badge";
import type { SessionSummary } from "@/lib/sessions/types";

const DATE_FORMAT = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "short",
  day: "numeric",
});

export function SessionRow({ session }: { session: SessionSummary }) {
  const playerLabel =
    session.playerCount === 1 ? "1 player" : `${session.playerCount} players`;
  return (
    <li className="border-b last:border-b-0">
      <Link
        href={`/sessions/${session.name}`}
        className="flex items-center justify-between gap-4 px-4 py-3 transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none"
      >
        <div className="min-w-0 flex-1">
          <div className="font-medium text-foreground">{session.name}</div>
          <div className="text-sm text-muted-foreground">
            {DATE_FORMAT.format(session.createdAt)} · {playerLabel}
          </div>
        </div>
        <StatusBadge status={session.status} />
      </Link>
    </li>
  );
}
