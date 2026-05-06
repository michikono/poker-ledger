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
  const note = encodeURIComponent(args.note);
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
  // Venmo's mobile UI re-renders regular spaces (encoded as %20 or +) as a
  // literal `+` in the recipient's note. Non-breaking spaces (U+00A0,
  // encoded as %C2%A0) survive the round-trip and render as a normal-looking
  // space. The session name's own whitespace is normalized to NBSP for the
  // same reason.
  const NBSP = " ";
  const safeName = session.name.replace(/\s+/g, NBSP);
  return `Poker${NBSP}on${NBSP}${formatLocalIsoDate(session.createdAt)}${NBSP}(${safeName})`;
}
