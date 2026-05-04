const RE = /^\$?\s*(\d+)(?:[.,](\d{0,2}))?\s*$/;

export function parseDollars(input: string): number | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const m = RE.exec(trimmed);
  if (!m) return null;
  const dollars = Number.parseInt(m[1] ?? "0", 10);
  const cents = m[2] ? Number.parseInt(m[2].padEnd(2, "0"), 10) : 0;
  return dollars * 100 + cents;
}
