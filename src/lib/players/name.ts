// Player-name validation rules shared between server actions and client
// forms. Keep these in sync with `validateName` in `actions.ts`.

export const PLAYER_NAME_MIN_LENGTH = 1;
export const PLAYER_NAME_MAX_LENGTH = 50;

const HAS_LETTER_OR_EMOJI = /[\p{L}\p{Extended_Pictographic}]/u;

export type PlayerNameError =
  | { kind: "empty" }
  | { kind: "too_long" }
  | { kind: "no_letter_or_emoji" };

export function describePlayerNameError(err: PlayerNameError): string {
  switch (err.kind) {
    case "empty":
      return "Name is required.";
    case "too_long":
      return `Name must be ${PLAYER_NAME_MAX_LENGTH} characters or less.`;
    case "no_letter_or_emoji":
      return "Name must include at least one letter or emoji.";
  }
}

export function validatePlayerName(
  raw: string,
): { ok: true; trimmed: string } | { ok: false; error: PlayerNameError } {
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length < PLAYER_NAME_MIN_LENGTH) {
    return { ok: false, error: { kind: "empty" } };
  }
  if (trimmed.length > PLAYER_NAME_MAX_LENGTH) {
    return { ok: false, error: { kind: "too_long" } };
  }
  if (!HAS_LETTER_OR_EMOJI.test(trimmed)) {
    return { ok: false, error: { kind: "no_letter_or_emoji" } };
  }
  return { ok: true, trimmed };
}
