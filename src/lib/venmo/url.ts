const HANDLE_RE = /^[A-Za-z0-9_.-]{5,30}$/;

export function parseVenmoHandle(
  input: string | null | undefined,
): string | null {
  if (input == null) return null;
  let s = input.trim();
  if (s.startsWith("@")) s = s.slice(1);
  if (!HANDLE_RE.test(s)) return null;
  return s;
}

export function buildVenmoPayUrl(args: {
  handle: string;
  amountCents: number;
  note: string;
}): string | null {
  const handle = parseVenmoHandle(args.handle);
  if (!handle) return null;
  if (!Number.isInteger(args.amountCents) || args.amountCents <= 0) return null;

  const dollars = (args.amountCents / 100).toFixed(2);
  // Venmo's deep-link parser is form-urlencoded: it shows `+` literally for
  // spaces encoded as `%20`, so we encode spaces as `+` instead. Parens and
  // commas are not encoded; Venmo accepts them raw.
  const note = encodeURIComponent(args.note)
    .replace(/%20/g, "+")
    .replace(/%2C/g, ",")
    .replace(/%28/g, "(")
    .replace(/%29/g, ")");
  return `https://venmo.com/${handle}?txn=pay&amount=${dollars}&note=${note}`;
}

export function formatLocalIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function formatVenmoNote(session: {
  name: string;
  createdAt: Date;
}): string {
  return `Poker on ${formatLocalIsoDate(session.createdAt)} (${session.name})`;
}
