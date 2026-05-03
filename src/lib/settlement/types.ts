export type PlayerInput = {
  id: string;
  createdAtMs: number;
  totalBuyInCents: number;
  cashOutCents: number | null;
};

export type Payment = {
  fromPlayerId: string;
  toPlayerId: string;
  amountCents: number;
};

export type SettlingValidationResult =
  | { ok: true }
  | {
      ok: false;
      code: "INVALID_INPUT" | "BALANCE_OUT_OF_RANGE";
      missingCashOutPlayerIds?: string[];
      shortfallCents?: number;
      totalBuyInCents?: number;
      totalCashOutCents?: number;
    };
