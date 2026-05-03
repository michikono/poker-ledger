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
    <li className="flex items-center justify-between gap-4 border-b px-4 py-3 last:border-b-0">
      <div className="min-w-0 flex-1">
        <Link
          href={`/sessions/${session.name}`}
          className="font-medium text-foreground hover:underline"
        >
          {session.name}
        </Link>
        <div className="text-sm text-muted-foreground">
          {DATE_FORMAT.format(session.createdAt)} · {playerLabel}
        </div>
      </div>
      <StatusBadge status={session.status} />
    </li>
  );
}
