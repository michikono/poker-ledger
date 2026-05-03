import type { ReactNode } from "react";

// Renders a changelog description that uses **...** for monetary highlights.
// Only `**...**` markers are recognized; no other markdown.
export function renderLogDescription(description: string): ReactNode[] {
  const parts: ReactNode[] = [];
  const re = /\*\*([^*]+)\*\*/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  // biome-ignore lint/suspicious/noAssignInExpressions: classic regex iteration
  while ((match = re.exec(description)) !== null) {
    if (match.index > lastIndex) {
      parts.push(description.slice(lastIndex, match.index));
    }
    parts.push(
      <strong key={`s-${key++}`} className="font-semibold">
        {match[1]}
      </strong>,
    );
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < description.length) {
    parts.push(description.slice(lastIndex));
  }
  return parts;
}

const MS_MIN = 60 * 1000;
const MS_HOUR = 60 * MS_MIN;
const MS_DAY = 24 * MS_HOUR;

export function formatRelativeTime(
  iso: string,
  now: Date = new Date(),
): string {
  const then = new Date(iso);
  const diffMs = now.getTime() - then.getTime();

  if (diffMs < 0) return "just now";
  if (diffMs < MS_MIN) return "just now";
  if (diffMs < MS_HOUR) {
    const m = Math.floor(diffMs / MS_MIN);
    return `${m}m ago`;
  }
  if (diffMs < MS_DAY) {
    const h = Math.floor(diffMs / MS_HOUR);
    return `${h}h ago`;
  }

  const sameDay =
    then.getFullYear() === now.getFullYear() &&
    then.getMonth() === now.getMonth() &&
    then.getDate() === now.getDate();
  if (sameDay) return "Today";

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    then.getFullYear() === yesterday.getFullYear() &&
    then.getMonth() === yesterday.getMonth() &&
    then.getDate() === yesterday.getDate();
  if (isYesterday) {
    const time = then.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
    return `Yesterday at ${time}`;
  }

  const date = then.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
  const time = then.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
  return `${date} at ${time}`;
}
