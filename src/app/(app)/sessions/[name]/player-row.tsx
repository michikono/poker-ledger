"use client";

import { Loader2, Pencil, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  type FormEvent,
  type Ref,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import { VenmoIcon } from "@/components/icons/venmo-icon";
import { Button } from "@/components/ui/button";
import { CurrencyInput } from "@/components/ui/currency-input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { formatCents } from "@/lib/currency/format";
import { parseDollars } from "@/lib/currency/parse";
import { getClientAuth } from "@/lib/firebase/client";
import {
  describePlayerNameError,
  validatePlayerName,
} from "@/lib/players/name";
import { cn } from "@/lib/utils";
import type { SessionStatus } from "@/lib/sessions/types";
import { parseVenmoHandle } from "@/lib/venmo/url";
import {
  addBuyIn,
  deletePlayer,
  removeBuyIn,
  setCashOut,
  updatePlayer,
} from "./actions";
import type { SessionPlayerView } from "./page";
import { computePlayerTotals } from "./totals";

const GENERIC_ERROR = "Something went wrong — please try again.";

type BusyOp = "cashOut" | "buyIn" | "save" | "delete" | null;

async function getToken(): Promise<string | null> {
  try {
    const auth = getClientAuth();
    await auth.authStateReady();
    return (await auth.currentUser?.getIdToken()) ?? null;
  } catch {
    return null;
  }
}

function redirectToSignIn() {
  if (typeof window !== "undefined") {
    window.location.href = `/sign-in?from=${encodeURIComponent(window.location.pathname)}`;
  }
}

export type PlayerRowHandle = {
  openEdit: (options?: { focus?: "name" | "venmo" }) => void;
};

export function PlayerRow({
  sessionId,
  status,
  player,
  ref,
}: {
  sessionId: string;
  status: SessionStatus;
  player: SessionPlayerView;
  ref?: Ref<PlayerRowHandle>;
}) {
  const router = useRouter();
  const editable = status === "in_progress";

  const rowRef = useRef<HTMLTableRowElement | null>(null);
  const nameInputRef = useRef<HTMLInputElement | null>(null);
  const venmoInputRef = useRef<HTMLInputElement | null>(null);
  const [editing, setEditing] = useState(false);
  const [editFocus, setEditFocus] = useState<"name" | "venmo">("name");
  const [nameDraft, setNameDraft] = useState(player.name);
  const [venmoDraft, setVenmoDraft] = useState(player.venmoUsername ?? "");
  const [editError, setEditError] = useState<{
    field: "name" | "venmo";
    message: string;
  } | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const [addingBuyIn, setAddingBuyIn] = useState(false);
  const [buyInDraft, setBuyInDraft] = useState("");
  const [buyInError, setBuyInError] = useState<string | null>(null);

  const [cashOutDraft, setCashOutDraft] = useState(
    player.cashOutCents === null ? "" : (player.cashOutCents / 100).toFixed(2),
  );
  const [cashOutError, setCashOutError] = useState<string | null>(null);

  const [busyOp, setBusyOp] = useState<BusyOp>(null);
  const [busyRemovingId, setBusyRemovingId] = useState<string | null>(null);
  const busy = busyOp !== null || busyRemovingId !== null;

  const totals = computePlayerTotals(
    player.buyIns.map((b) => ({ amountCents: b.amountCents })),
    player.cashOutCents,
  );

  async function withToken<T>(
    fn: (token: string) => Promise<T>,
  ): Promise<T | null> {
    const token = await getToken();
    if (!token) {
      redirectToSignIn();
      return null;
    }
    return await fn(token);
  }

  function resetEditDraft() {
    setNameDraft(player.name);
    setVenmoDraft(player.venmoUsername ?? "");
    setEditError(null);
  }

  // Imperative API for parent-driven actions (e.g., the "Add Venmo for X"
  // affordance on a payment row asks the matching player's row to enter
  // edit mode focused on the Venmo handle field). Re-creating the handle
  // on every render keeps the closure's state references current.
  useImperativeHandle(ref, () => ({
    openEdit: (options) => {
      if (status === "archived") return;
      setNameDraft(player.name);
      setVenmoDraft(player.venmoUsername ?? "");
      setEditError(null);
      setEditFocus(options?.focus ?? "name");
      setEditing(true);
      rowRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      // The form mounts on the next render; focus once it's there.
      requestAnimationFrame(() => {
        const target =
          options?.focus === "venmo" ? venmoInputRef : nameInputRef;
        target.current?.focus();
        target.current?.select?.();
      });
    },
  }));

  async function handleSaveEdit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;

    const nameResult = validatePlayerName(nameDraft);
    if (!nameResult.ok) {
      setEditError({
        field: "name",
        message: describePlayerNameError(nameResult.error),
      });
      return;
    }
    const trimmedName = nameResult.trimmed;

    const trimmedVenmo = venmoDraft.trim();
    let venmoToSend: string | null;
    if (trimmedVenmo === "" || trimmedVenmo === "@") {
      venmoToSend = null;
    } else {
      const parsed = parseVenmoHandle(trimmedVenmo);
      if (parsed === null) {
        setEditError({
          field: "venmo",
          message:
            "Use 5–30 characters: letters, digits, _ . or - (no spaces).",
        });
        return;
      }
      venmoToSend = parsed;
    }

    setBusyOp("save");
    setEditError(null);
    const result = await withToken((token) =>
      updatePlayer(
        {
          sessionId,
          playerId: player.id,
          name: trimmedName,
          venmoUsername: venmoToSend,
        },
        token,
      ),
    );
    setBusyOp(null);
    if (!result) return;
    if (result.success) {
      setEditing(false);
      router.refresh();
      return;
    }
    if (result.error.code === "DUPLICATE_PLAYER_NAME") {
      setEditError({
        field: "name",
        message: "A player with that name already exists.",
      });
      return;
    }
    if (result.error.code === "INVALID_PLAYER_NAME") {
      setEditError({ field: "name", message: result.error.message });
      return;
    }
    if (result.error.code === "INVALID_VENMO_USERNAME") {
      setEditError({ field: "venmo", message: result.error.message });
      return;
    }
    toast.error(GENERIC_ERROR);
  }

  async function handleConfirmDelete() {
    if (busy) return;
    setBusyOp("delete");
    const result = await withToken((token) =>
      deletePlayer({ sessionId, playerId: player.id }, token),
    );
    setBusyOp(null);
    if (!result) return;
    if (result.success) {
      setConfirmingDelete(false);
      setEditing(false);
      router.refresh();
      return;
    }
    toast.error(GENERIC_ERROR);
  }

  async function handleAddBuyIn(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBuyInError(null);

    const trimmed = buyInDraft.trim();
    if (!trimmed) {
      setBuyInError("Enter an amount.");
      return;
    }
    const cents = parseDollars(trimmed);
    if (cents === null || cents <= 0 || cents > 2_000_000) {
      setBuyInError("Enter a valid amount, e.g., 25 or 25.00.");
      return;
    }

    setBusyOp("buyIn");
    const result = await withToken((token) =>
      addBuyIn({ sessionId, playerId: player.id, amountCents: cents }, token),
    );
    setBusyOp(null);
    if (!result) return;
    if (result.success) {
      setBuyInDraft("");
      setAddingBuyIn(false);
      router.refresh();
      return;
    }
    toast.error(GENERIC_ERROR);
  }

  async function handleRemoveBuyIn(buyInId: string) {
    if (busy) return;
    setBusyRemovingId(buyInId);
    const result = await withToken((token) =>
      removeBuyIn({ sessionId, playerId: player.id, buyInId }, token),
    );
    setBusyRemovingId(null);
    if (!result) return;
    if (result.success) {
      router.refresh();
      return;
    }
    toast.error(GENERIC_ERROR);
  }

  async function commitCashOut() {
    if (busy) return;
    setCashOutError(null);

    let target: number | null;
    const trimmed = cashOutDraft.trim();
    if (trimmed === "") {
      target = null;
    } else {
      const cents = parseDollars(trimmed);
      if (cents === null || cents < 0 || cents > 2_000_000) {
        setCashOutError("Enter a valid amount, e.g., 25 or 25.00.");
        return;
      }
      target = cents;
    }

    if (target === player.cashOutCents) return;

    setBusyOp("cashOut");
    const result = await withToken((token) =>
      setCashOut(
        { sessionId, playerId: player.id, amountCents: target },
        token,
      ),
    );
    setBusyOp(null);
    if (!result) return;
    if (result.success) {
      router.refresh();
      return;
    }
    toast.error(GENERIC_ERROR);
  }

  return (
    <tr
      ref={rowRef}
      className="border-t"
      data-testid={`player-row-${player.id}`}
    >
      <td className="p-3">
        {editing ? (
          <form
            className="flex flex-col gap-2"
            onSubmit={handleSaveEdit}
            aria-label={`Edit ${player.name}`}
          >
            <div className="flex flex-col gap-1">
              <Input
                ref={nameInputRef}
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                autoFocus={editFocus === "name"}
                maxLength={50}
                aria-label="Name"
                aria-invalid={editError?.field === "name" ? true : undefined}
                disabled={busy}
              />
              {editError?.field === "name" && (
                <span className="text-xs text-destructive">
                  {editError.message}
                </span>
              )}
            </div>
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-1">
                <VenmoIcon size={16} className="shrink-0" title="Venmo" />
                <span
                  className="text-sm text-muted-foreground"
                  aria-hidden="true"
                >
                  @
                </span>
                <Input
                  ref={venmoInputRef}
                  value={venmoDraft}
                  onChange={(e) => setVenmoDraft(e.target.value)}
                  autoFocus={editFocus === "venmo"}
                  maxLength={31}
                  aria-label="Venmo handle (optional)"
                  aria-invalid={editError?.field === "venmo" ? true : undefined}
                  disabled={busy}
                  placeholder="venmo-handle (optional)"
                />
              </div>
              {editError?.field === "venmo" && (
                <span className="text-xs text-destructive">
                  {editError.message}
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-1">
              <Button type="submit" size="sm" disabled={busy}>
                {busyOp === "save" && (
                  <Loader2 className="mr-1 size-3 animate-spin" />
                )}
                Save
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  setEditing(false);
                  resetEditDraft();
                }}
                disabled={busy}
              >
                Cancel
              </Button>
              {editable && (
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  onClick={() => setConfirmingDelete(true)}
                  disabled={busy}
                >
                  Delete player
                </Button>
              )}
            </div>
          </form>
        ) : (
          <button
            type="button"
            className="group flex items-center gap-1.5 text-left font-medium hover:text-primary disabled:hover:text-foreground"
            onClick={() => {
              if (status === "archived") return;
              resetEditDraft();
              setEditFocus("name");
              setEditing(true);
            }}
            disabled={status === "archived"}
            aria-label={`Edit ${player.name}`}
          >
            <span className="underline-offset-4 group-hover:underline group-disabled:no-underline">
              {player.name}
            </span>
            {player.venmoUsername && (
              <VenmoIcon
                size={14}
                className="shrink-0 opacity-90"
                title={`Venmo: @${player.venmoUsername}`}
              />
            )}
            {status !== "archived" && (
              <Pencil
                aria-hidden="true"
                className="size-3 shrink-0 text-muted-foreground transition-opacity group-hover:text-primary"
              />
            )}
          </button>
        )}

        <Dialog
          open={confirmingDelete}
          onOpenChange={(next) => {
            if (!next && busyOp === "delete") return;
            setConfirmingDelete(next);
          }}
        >
          <DialogContent
            data-testid={`delete-player-dialog-${player.id}`}
            showCloseButton={false}
          >
            <DialogHeader>
              <DialogTitle>Delete player?</DialogTitle>
              <DialogDescription>
                Delete {player.name}? This permanently removes their buy-ins and
                cash-out from the session. This cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setConfirmingDelete(false)}
                disabled={busyOp === "delete"}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={() => void handleConfirmDelete()}
                disabled={busyOp === "delete"}
              >
                {busyOp === "delete" && (
                  <Loader2 className="mr-1 size-3 animate-spin" />
                )}
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </td>

      <td className="p-3">
        <div className="flex flex-col gap-2">
          {editable && (
            <div>
              {addingBuyIn ? (
                <form className="flex flex-col gap-1" onSubmit={handleAddBuyIn}>
                  <div className="flex items-center gap-1">
                    <CurrencyInput
                      placeholder="0.00"
                      value={buyInDraft}
                      onChange={setBuyInDraft}
                      disabled={busy}
                      autoFocus
                      aria-invalid={buyInError ? true : undefined}
                      className="h-7 w-24 text-xs"
                      aria-label={`Add buy-in for ${player.name}`}
                    />
                    <Button type="submit" size="sm" disabled={busy}>
                      {busyOp === "buyIn" ? (
                        <Loader2 className="size-3 animate-spin" />
                      ) : (
                        "Add"
                      )}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setAddingBuyIn(false);
                        setBuyInDraft("");
                        setBuyInError(null);
                      }}
                      disabled={busy}
                    >
                      Cancel
                    </Button>
                  </div>
                  {buyInError && (
                    <p className="text-xs text-destructive">{buyInError}</p>
                  )}
                </form>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setAddingBuyIn(true)}
                  disabled={busy}
                  data-testid={`add-buy-in-cta-${player.id}`}
                >
                  <Plus className="size-3" />
                  Add buy-in
                </Button>
              )}
            </div>
          )}

          {player.buyIns.length > 0 && (
            <div className="flex flex-wrap items-center gap-1">
              {player.buyIns.map((b) => (
                <span
                  key={b.id}
                  className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs"
                  data-testid={`buy-in-${b.id}`}
                >
                  {formatCents(b.amountCents)}
                  {editable && (
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-destructive"
                      aria-label={`Remove ${formatCents(b.amountCents)} buy-in`}
                      onClick={() => void handleRemoveBuyIn(b.id)}
                      disabled={busy}
                    >
                      {busyRemovingId === b.id ? (
                        <Loader2 className="size-2.5 animate-spin" />
                      ) : (
                        "×"
                      )}
                    </button>
                  )}
                </span>
              ))}
            </div>
          )}
        </div>
      </td>

      <td className="p-3 text-right tabular-nums">
        {formatCents(totals.totalBuyInCents)}
      </td>

      <td className="p-3 text-right">
        {editable ? (
          <div className="flex flex-col items-end gap-1">
            <div className="relative">
              <CurrencyInput
                placeholder="—"
                value={cashOutDraft}
                onChange={setCashOutDraft}
                onBlur={() => void commitCashOut()}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    (e.currentTarget as HTMLInputElement).blur();
                  }
                }}
                disabled={busy}
                aria-invalid={cashOutError ? true : undefined}
                className={cn(
                  "h-8 w-24 text-right",
                  busyOp === "cashOut" && "pr-8",
                )}
                aria-label={`Cash out for ${player.name}`}
                data-testid={`cash-out-${player.id}`}
              />
              {busyOp === "cashOut" && (
                <Loader2
                  aria-label="Saving"
                  className="pointer-events-none absolute right-2 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground"
                />
              )}
            </div>
            {cashOutError && (
              <span className="text-xs text-destructive">{cashOutError}</span>
            )}
          </div>
        ) : (
          <span className="tabular-nums">
            {player.cashOutCents === null
              ? "—"
              : formatCents(player.cashOutCents)}
          </span>
        )}
      </td>

      <td className="p-3 text-right tabular-nums">
        {totals.netCents === null
          ? "—"
          : totals.netCents === 0
            ? formatCents(0)
            : totals.netCents > 0
              ? `+${formatCents(totals.netCents)}`
              : formatCents(totals.netCents)}
      </td>
    </tr>
  );
}
