import { formatCents } from "@/lib/currency/format";
import { type SessionTotals, balanceState } from "./totals";

export function DeltaIndicator({ totals }: { totals: SessionTotals }) {
  const state = balanceState(totals);
  const { shortfallCents, totalBuyInCents, totalCashOutCents } = totals;

  let label: string;
  if (state === "no_buy_ins") {
    label = "No buy-ins yet";
  } else if (shortfallCents === 0) {
    label = "Balanced";
  } else if (shortfallCents > 0) {
    label = `${formatCents(shortfallCents)} short`;
  } else {
    label = `${formatCents(-shortfallCents)} over`;
  }

  const colorClass =
    state === "balanced"
      ? "bg-success/15 text-success border-success/30"
      : state === "out_of_range"
        ? "bg-warning/15 text-warning border-warning/30"
        : "bg-muted text-muted-foreground border";

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-md border px-2 py-1 text-xs font-medium ${colorClass}`}
      data-testid="delta-indicator"
      data-state={state}
    >
      <span>
        {formatCents(totalCashOutCents)} / {formatCents(totalBuyInCents)}
      </span>
      <span aria-hidden="true">·</span>
      <span>{label}</span>
    </span>
  );
}
