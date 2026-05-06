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
  const note = encodeURIComponent(args.note).replace(/%2C/g, ",");
  // encodeURIComponent encodes parens; Venmo handles them fine and tests
  // expect raw parens to round-trip, so decode them back for readability.
  const friendly = note.replace(/%28/g, "(").replace(/%29/g, ")");
  return `https://venmo.com/${handle}?txn=pay&amount=${dollars}&note=${friendly}`;
}

export function formatVenmoNote(session: {
  name: string;
  createdAt: Date;
}): string {
  const y = session.createdAt.getUTCFullYear();
  const m = String(session.createdAt.getUTCMonth() + 1).padStart(2, "0");
  const d = String(session.createdAt.getUTCDate()).padStart(2, "0");
  return `Poker on ${y}-${m}-${d} (${session.name})`;
}
