export const GENERIC_ERROR = "Something went wrong — please try again.";

export type ServerActionErrorCode =
  | "UNAUTHENTICATED"
  | "SESSION_NOT_FOUND"
  | "SESSION_NOT_EDITABLE"
  | "INVALID_STATE_TRANSITION"
  | "DUPLICATE_PLAYER_NAME"
  | "INVALID_VENMO_USERNAME"
  | "PAYMENT_NOT_FOUND"
  | "PLAYER_NOT_FOUND"
  | "BUY_IN_NOT_FOUND"
  | "INVALID_INPUT"
  | "BALANCE_OUT_OF_RANGE"
  | "INTERNAL_ERROR"
  | "INVALID_AMOUNT"
  | "INVALID_PLAYER_NAME"
  | "NAME_COLLISION";

export function describeErrorCode(code: string): string {
  const narrowed = code as ServerActionErrorCode;
  switch (narrowed) {
    case "UNAUTHENTICATED":
      return "Session expired — please sign in again.";
    case "SESSION_NOT_FOUND":
      return "Session not found.";
    case "SESSION_NOT_EDITABLE":
      return "This session can't be edited in its current state.";
    case "INVALID_STATE_TRANSITION":
      return "Can't perform that action right now.";
    case "DUPLICATE_PLAYER_NAME":
      return "A player with that name already exists.";
    case "INVALID_VENMO_USERNAME":
      return "Venmo username must be 5–30 characters: letters, digits, _ . or -.";
    case "PAYMENT_NOT_FOUND":
    case "PLAYER_NOT_FOUND":
    case "BUY_IN_NOT_FOUND":
      return "Some data is out of date — refreshing.";
    case "INVALID_INPUT":
      return "All players must have a cash-out set.";
    case "BALANCE_OUT_OF_RANGE":
      return "Cash-outs do not match buy-ins within tolerance.";
    // Codes whose UX is form-field-level at the call site (the call site
    // surfaces the action's own message via setError, not a toast). The
    // generic fallback below is correct if one ever does end up in a toast.
    case "INTERNAL_ERROR":
    case "INVALID_AMOUNT":
    case "INVALID_PLAYER_NAME":
    case "NAME_COLLISION":
      return GENERIC_ERROR;
    default: {
      const _exhaustive: never = narrowed;
      void _exhaustive;
      return GENERIC_ERROR;
    }
  }
}
