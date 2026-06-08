"use client";

import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { Check, Loader2, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
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
import { withToken } from "@/lib/auth/client-token";
import { formatCents } from "@/lib/currency/format";
import { parseDollars } from "@/lib/currency/parse";
import { describeErrorCode } from "@/lib/errors/messages";
import {
  describePlayerNameError,
  validatePlayerName,
} from "@/lib/players/name";
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

type SaveError =
  | { kind: "field"; field: "name" | "venmo"; message: string }
  | { kind: "generic"; message: string };

type RowError = { kind: "validation" | "generic"; message: string } | null;

export type PlayerDetailsSheetProps = {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  sessionId: string;
  status: SessionStatus;
  player: SessionPlayerView;
  initialFocus?: "name" | "venmo";
  /**
   * Notifies the parent (typically PlayerList) that this player just
   * changed in some way the user should see — used to flash the row
   * after save / add buy-in / remove buy-in / cash-out edit. The toast
   * is fired from this component directly; the callback is purely for
   * the visual highlight.
   */
  onPlayerChanged?: (playerId: string) => void;
};

/**
 * Full-bleed mobile / centered-dialog desktop sheet that owns every
 * per-player edit. Per-field editability tracks the session status so
 * the sheet adapts:
 *
 *   in_progress: name, Venmo, cash-out, buy-ins (add + remove), delete
 *                are all editable (full editor).
 *   settling / settled: only Venmo is editable. Name and cash-out
 *                show as text. Buy-ins collapse to a single sum line
 *                (no list, no add, no remove). Delete is hidden.
 *                Cash-out edits would invalidate the computed payments,
 *                so they require an explicit roll-back via the
 *                session-view CTA — surfaced inline as a hint here.
 *   archived:    everything is text. No Save action.
 */
export function PlayerDetailsSheet({
  open,
  onOpenChange,
  sessionId,
  status,
  player,
  initialFocus = "name",
  onPlayerChanged,
}: PlayerDetailsSheetProps) {
  const router = useRouter();
  const inProgress = status === "in_progress";
  const archived = status === "archived";
  // Per-field editability flags. Server constraints are the source of
  // truth (updatePlayer allows Venmo + name in any non-archived state;
  // setCashOut blocks anything except in_progress).
  const nameEditable = inProgress;
  const venmoEditable = !archived;
  const cashOutEditable = inProgress;
  const buyInsEditable = inProgress;
  const deleteVisible = inProgress;
  // The header Save button shows up if any field is editable in this
  // mode — i.e., everything except `archived`.
  const anyFieldEditable = !archived;

  const nameInputRef = useRef<HTMLInputElement | null>(null);
  const venmoInputRef = useRef<HTMLInputElement | null>(null);

  const [nameDraft, setNameDraft] = useState(player.name);
  const [venmoDraft, setVenmoDraft] = useState(player.venmoUsername ?? "");
  const [cashOutDraft, setCashOutDraft] = useState(
    player.cashOutCents === null ? "" : (player.cashOutCents / 100).toFixed(2),
  );
  const [saveError, setSaveError] = useState<SaveError | null>(null);
  const [saving, setSaving] = useState(false);

  const [buyInDraft, setBuyInDraft] = useState("");
  const [buyInError, setBuyInError] = useState<RowError>(null);
  const [addingBuyIn, setAddingBuyIn] = useState(false);

  const [removingId, setRemovingId] = useState<string | null>(null);
  const [removeError, setRemoveError] = useState<{
    buyInId: string;
    message: string;
  } | null>(null);

  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [confirmingDiscard, setConfirmingDiscard] = useState(false);

  const busy = saving || addingBuyIn || removingId !== null || deleting;

  // Reset drafts on open or whenever the underlying player changes (after a
  // server refresh produced new buy-ins / cash-out). Also reset every busy
  // flag so a stuck `saving` from a prior in-flight request can't disable
  // the Cancel button when the sheet reopens.
  useEffect(() => {
    if (!open) return;
    setNameDraft(player.name);
    setVenmoDraft(player.venmoUsername ?? "");
    setCashOutDraft(
      player.cashOutCents === null
        ? ""
        : (player.cashOutCents / 100).toFixed(2),
    );
    setSaveError(null);
    setBuyInError(null);
    setRemoveError(null);
    setSaving(false);
    setAddingBuyIn(false);
    setRemovingId(null);
    setDeleting(false);
    setConfirmingDiscard(false);
  }, [open, player]);

  useEffect(() => {
    if (!open) return;
    const id = requestAnimationFrame(() => {
      const target = initialFocus === "venmo" ? venmoInputRef : nameInputRef;
      target.current?.select?.();
    });
    return () => cancelAnimationFrame(id);
  }, [open, initialFocus]);

  const totalBuyInCents = useMemo(
    () => player.buyIns.reduce((sum, b) => sum + b.amountCents, 0),
    [player.buyIns],
  );

  const dirty = useMemo(() => {
    if (nameDraft.trim() !== player.name) return true;
    const venmoOriginal = player.venmoUsername ?? "";
    if (venmoDraft.trim() !== venmoOriginal) return true;
    const cashOriginal =
      player.cashOutCents === null
        ? ""
        : (player.cashOutCents / 100).toFixed(2);
    if (cashOutDraft.trim() !== cashOriginal) return true;
    return false;
  }, [nameDraft, venmoDraft, cashOutDraft, player]);

  // Single entry point for every "user wants to leave" gesture (Cancel button,
  // backdrop click, Escape). Frictionless when there's nothing to lose; asks
  // first when there are unsaved field edits. Buy-ins are excluded on purpose —
  // they save immediately, so they're never "pending". Saving in progress is
  // never interrupted.
  function attemptClose() {
    if (saving) return;
    if (dirty) {
      setConfirmingDiscard(true);
      return;
    }
    onOpenChange(false);
  }

  async function handleSave(e?: FormEvent) {
    e?.preventDefault();
    if (busy) return;
    setSaveError(null);

    // Validate name.
    const nameResult = validatePlayerName(nameDraft);
    if (!nameResult.ok) {
      setSaveError({
        kind: "field",
        field: "name",
        message: describePlayerNameError(nameResult.error),
      });
      return;
    }
    const trimmedName = nameResult.trimmed;

    // Validate Venmo.
    const trimmedVenmo = venmoDraft.trim();
    let venmoToSend: string | null;
    if (trimmedVenmo === "" || trimmedVenmo === "@") {
      venmoToSend = null;
    } else {
      const parsed = parseVenmoHandle(trimmedVenmo);
      if (parsed === null) {
        setSaveError({
          kind: "field",
          field: "venmo",
          message:
            "Use 5–30 characters: letters, digits, _ . or - (no spaces).",
        });
        return;
      }
      venmoToSend = parsed;
    }

    // Validate cash-out.
    const trimmedCashOut = cashOutDraft.trim();
    let cashOutToSend: number | null = null;
    if (trimmedCashOut !== "") {
      const cents = parseDollars(trimmedCashOut);
      if (cents === null || cents < 0 || cents > 2_000_000) {
        setSaveError({
          kind: "generic",
          message: "Enter a valid cash-out amount, e.g., 25 or 25.00.",
        });
        return;
      }
      cashOutToSend = cents;
    }

    setSaving(true);

    const nameOrVenmoChanged =
      trimmedName !== player.name ||
      venmoToSend !== (player.venmoUsername ?? null);
    const cashOutChanged = cashOutToSend !== player.cashOutCents;

    // try/finally guarantees `saving` clears even if the action rejects
    // (network failure, server throw). Without it, Cancel/Esc/backdrop
    // would all stay disabled and the user gets trapped in the sheet.
    let saved = false;
    try {
      if (nameOrVenmoChanged) {
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
        if (!result) return;
        if (!result.success) {
          if (result.error.code === "DUPLICATE_PLAYER_NAME") {
            setSaveError({
              kind: "field",
              field: "name",
              message: "A player with that name already exists.",
            });
            return;
          }
          if (result.error.code === "INVALID_PLAYER_NAME") {
            setSaveError({
              kind: "field",
              field: "name",
              message: result.error.message,
            });
            return;
          }
          if (result.error.code === "INVALID_VENMO_USERNAME") {
            setSaveError({
              kind: "field",
              field: "venmo",
              message: result.error.message,
            });
            return;
          }
          setSaveError({
            kind: "generic",
            message: describeErrorCode(result.error.code),
          });
          return;
        }
      }

      if (cashOutChanged) {
        const result = await withToken((token) =>
          setCashOut(
            { sessionId, playerId: player.id, amountCents: cashOutToSend },
            token,
          ),
        );
        if (!result) return;
        if (!result.success) {
          setSaveError({
            kind: "generic",
            message: describeErrorCode(result.error.code),
          });
          return;
        }
      }

      saved = true;
    } catch {
      setSaveError({
        kind: "generic",
        message: "Couldn't save changes. Check your connection and try again.",
      });
    } finally {
      setSaving(false);
    }

    if (!saved) return;
    toast.success(`Saved changes to ${trimmedName}`);
    onPlayerChanged?.(player.id);
    onOpenChange(false);
    router.refresh();
  }

  async function handleAddBuyIn(e?: FormEvent) {
    e?.preventDefault();
    if (busy) return;
    setBuyInError(null);

    const trimmed = buyInDraft.trim();
    if (!trimmed) {
      setBuyInError({ kind: "validation", message: "Enter an amount." });
      return;
    }
    const cents = parseDollars(trimmed);
    if (cents === null || cents <= 0 || cents > 2_000_000) {
      setBuyInError({
        kind: "validation",
        message: "Enter a valid amount, e.g., 25 or 25.00.",
      });
      return;
    }

    setAddingBuyIn(true);
    try {
      const result = await withToken((token) =>
        addBuyIn({ sessionId, playerId: player.id, amountCents: cents }, token),
      );
      if (!result) return;
      if (result.success) {
        setBuyInDraft("");
        toast.success(`Added ${formatCents(cents)} buy-in for ${player.name}`);
        onPlayerChanged?.(player.id);
        router.refresh();
        return;
      }
      setBuyInError({
        kind: "generic",
        message: describeErrorCode(result.error.code),
      });
    } catch {
      setBuyInError({
        kind: "generic",
        message:
          "Couldn't add the buy-in. Check your connection and try again.",
      });
    } finally {
      setAddingBuyIn(false);
    }
  }

  async function handleRemoveBuyIn(buyInId: string) {
    if (busy) return;
    setRemoveError(null);
    setRemovingId(buyInId);
    try {
      const result = await withToken((token) =>
        removeBuyIn({ sessionId, playerId: player.id, buyInId }, token),
      );
      if (!result) return;
      if (result.success) {
        toast.success(`Removed buy-in from ${player.name}`);
        onPlayerChanged?.(player.id);
        router.refresh();
        return;
      }
      setRemoveError({
        buyInId,
        message: describeErrorCode(result.error.code),
      });
    } catch {
      setRemoveError({
        buyInId,
        message:
          "Couldn't remove the buy-in. Check your connection and try again.",
      });
    } finally {
      setRemovingId(null);
    }
  }

  async function handleConfirmDelete() {
    if (busy) return;
    setDeleteError(null);
    setDeleting(true);
    try {
      const result = await withToken((token) =>
        deletePlayer({ sessionId, playerId: player.id }, token),
      );
      if (!result) return;
      if (result.success) {
        setConfirmingDelete(false);
        onOpenChange(false);
        toast.success(`Deleted ${player.name}`);
        router.refresh();
        return;
      }
      setDeleteError(describeErrorCode(result.error.code));
    } catch {
      setDeleteError(
        "Couldn't delete the player. Check your connection and try again.",
      );
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <DialogPrimitive.Root
        open={open}
        onOpenChange={(next) => {
          // Route every base-ui-initiated close (backdrop, Escape) through the
          // same unsaved-changes guard the Cancel button uses. Leaving `open`
          // true keeps the sheet mounted while the discard prompt is shown.
          if (!next) {
            attemptClose();
            return;
          }
          onOpenChange(next);
        }}
      >
        <DialogPrimitive.Portal>
          <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/40 transition-opacity duration-150 supports-backdrop-filter:backdrop-blur-xs data-ending-style:opacity-0 data-starting-style:opacity-0" />
          <DialogPrimitive.Popup
            data-slot="player-details-sheet"
            data-testid={`player-details-sheet-${player.id}`}
            className="fixed inset-0 z-50 flex flex-col bg-popover text-popover-foreground shadow-xl outline-none transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0 md:inset-y-4 md:left-1/2 md:h-auto md:max-h-[calc(100svh-2rem)] md:w-[calc(100%-2rem)] md:max-w-md md:-translate-x-1/2 md:rounded-xl md:ring-1 md:ring-foreground/10"
          >
            <header className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 border-b border-border px-2 py-2">
              <div className="justify-self-start">
                {/* Direct onClick instead of DialogPrimitive.Close render-prop
                    — the wrapper pattern can swallow taps when the rendered
                    element also passes `disabled`, which left users unable
                    to cancel out of the sheet. Closing imperatively via the
                    parent's onOpenChange is unambiguous. */}
                <Button
                  type="button"
                  variant="ghost"
                  aria-label={anyFieldEditable ? "Cancel" : "Close"}
                  disabled={saving}
                  onClick={attemptClose}
                  data-testid={`pds-cancel-${player.id}`}
                >
                  {anyFieldEditable ? "Cancel" : "Close"}
                </Button>
              </div>
              <DialogPrimitive.Title className="truncate text-center font-heading text-base font-medium">
                {inProgress ? "Edit player" : "Player details"}
              </DialogPrimitive.Title>
              <div className="justify-self-end">
                {anyFieldEditable && (
                  <Button
                    type="button"
                    onClick={() => void handleSave()}
                    disabled={busy || !dirty}
                    data-testid={`pds-save-${player.id}`}
                  >
                    {saving ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Check className="size-4" />
                    )}
                    Save
                  </Button>
                )}
              </div>
              <DialogPrimitive.Description className="sr-only">
                {inProgress
                  ? "Update name, Venmo handle, cash-out, and buy-ins."
                  : venmoEditable
                    ? "Update the Venmo handle. Other fields are locked while the session is settling."
                    : "Read-only. This session can no longer be edited."}
              </DialogPrimitive.Description>
            </header>

            <form
              onSubmit={handleSave}
              aria-label={`Edit ${player.name}`}
              className="flex flex-1 flex-col overflow-hidden"
            >
              <div className="flex-1 overflow-y-auto px-4 py-3 pb-[calc(env(safe-area-inset-bottom)+1rem)] md:pb-3">
                <div className="flex flex-col gap-4">
                  {/* 1. Name */}
                  <div className="flex flex-col gap-1">
                    <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Name
                    </span>
                    {nameEditable ? (
                      <>
                        <Input
                          id={`pds-name-${player.id}`}
                          ref={nameInputRef}
                          value={nameDraft}
                          onChange={(e) => setNameDraft(e.target.value)}
                          maxLength={50}
                          disabled={busy}
                          aria-label="Name"
                          aria-invalid={
                            saveError?.kind === "field" &&
                            saveError.field === "name"
                              ? true
                              : undefined
                          }
                        />
                        {saveError?.kind === "field" &&
                          saveError.field === "name" && (
                            <span className="text-xs text-destructive-fg">
                              {saveError.message}
                            </span>
                          )}
                      </>
                    ) : (
                      <p
                        className="text-base font-medium"
                        data-testid={`pds-name-text-${player.id}`}
                      >
                        {player.name}
                      </p>
                    )}
                  </div>

                  {/* 2. Venmo handle */}
                  <div className="flex flex-col gap-1">
                    <label
                      htmlFor={`pds-venmo-${player.id}`}
                      className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground"
                    >
                      <VenmoIcon size={14} title="Venmo" />
                      Venmo handle
                      <span className="font-normal normal-case text-muted-foreground">
                        (optional)
                      </span>
                    </label>
                    {venmoEditable ? (
                      <>
                        <div className="flex items-center gap-2">
                          <span
                            className="text-base text-muted-foreground md:text-sm"
                            aria-hidden="true"
                          >
                            @
                          </span>
                          <Input
                            id={`pds-venmo-${player.id}`}
                            ref={venmoInputRef}
                            value={venmoDraft}
                            onChange={(e) => setVenmoDraft(e.target.value)}
                            maxLength={31}
                            placeholder="venmo-handle"
                            disabled={busy}
                            aria-invalid={
                              saveError?.kind === "field" &&
                              saveError.field === "venmo"
                                ? true
                                : undefined
                            }
                          />
                        </div>
                        {saveError?.kind === "field" &&
                          saveError.field === "venmo" && (
                            <span className="text-xs text-destructive-fg">
                              {saveError.message}
                            </span>
                          )}
                      </>
                    ) : (
                      <p
                        className="text-base"
                        data-testid={`pds-venmo-text-${player.id}`}
                      >
                        {player.venmoUsername ? (
                          <span className="font-medium">
                            @{player.venmoUsername}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">Not set</span>
                        )}
                      </p>
                    )}
                  </div>

                  {/* 3. Add a buy-in (flat, same shape as other fields). NOT
                      a nested <form> — the outer save form wraps this section
                      and browsers flatten nested forms; we use a <fieldset>
                      and an explicit click handler so the submit signals never
                      cross. */}
                  {buyInsEditable && (
                    <fieldset
                      className="flex flex-col gap-1 border-0 p-0"
                      aria-label={`Add buy-in for ${player.name}`}
                      data-testid={`pds-add-buy-in-form-${player.id}`}
                    >
                      <label
                        htmlFor={`pds-add-buy-in-${player.id}`}
                        className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
                      >
                        Add a buy-in
                      </label>
                      {/* Input + Add button are stacked full-width so the
                          input matches the width of every other field in the
                          sheet (was previously inline-on-md+, which made the
                          input visually narrower than its peers). */}
                      <CurrencyInput
                        id={`pds-add-buy-in-${player.id}`}
                        placeholder="0.00"
                        value={buyInDraft}
                        onChange={setBuyInDraft}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            // Prevent the outer save form from firing when
                            // the user just wants to add a buy-in.
                            e.preventDefault();
                            e.stopPropagation();
                            void handleAddBuyIn();
                          }
                        }}
                        disabled={busy}
                        aria-invalid={buyInError ? true : undefined}
                        className="tabular-nums"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => void handleAddBuyIn()}
                        disabled={busy}
                        data-testid={`pds-add-buy-in-submit-${player.id}`}
                        className="w-full"
                      >
                        {addingBuyIn ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <Plus className="size-4" />
                        )}
                        Add buy-in
                      </Button>
                      {buyInError && (
                        <p className="text-xs text-destructive-fg">
                          {buyInError.message}
                        </p>
                      )}
                    </fieldset>
                  )}

                  {/* 4. Buy-ins list (or sum line when not editable) */}
                  {buyInsEditable ? (
                    <section className="flex flex-col gap-2">
                      <header className="flex items-baseline justify-between gap-2">
                        <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Buy-ins
                        </h3>
                        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground tabular-nums">
                          Total {formatCents(totalBuyInCents)}
                        </span>
                      </header>

                      {player.buyIns.length === 0 ? (
                        <p className="rounded-md border border-dashed bg-muted/40 px-3 py-3 text-sm text-muted-foreground">
                          No buy-ins yet.
                        </p>
                      ) : (
                        <ul className="flex flex-col divide-y divide-border rounded-md border bg-card">
                          {player.buyIns.map((b) => (
                            <li
                              key={b.id}
                              className="flex items-center justify-between gap-3 px-3 py-2"
                              data-testid={`pds-buy-in-${b.id}`}
                            >
                              <span className="text-base font-medium tabular-nums">
                                {formatCents(b.amountCents)}
                              </span>
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() => void handleRemoveBuyIn(b.id)}
                                disabled={busy}
                                aria-label={`Remove ${formatCents(b.amountCents)} buy-in`}
                                data-testid={`pds-remove-buy-in-${b.id}`}
                              >
                                {removingId === b.id ? (
                                  <Loader2 className="size-4 animate-spin" />
                                ) : (
                                  <Trash2 className="size-4" />
                                )}
                                Remove
                              </Button>
                            </li>
                          ))}
                        </ul>
                      )}

                      {removeError && (
                        <p role="alert" className="text-xs text-destructive-fg">
                          {removeError.message}
                        </p>
                      )}
                    </section>
                  ) : (
                    // Settling/settled/archived: collapse to a single sum
                    // line. Buy-ins are locked once settling begins, so the
                    // detail of each buy-in isn't actionable — just show the
                    // total + count.
                    <div className="flex flex-col gap-1">
                      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Buy-ins
                      </span>
                      <p
                        className="text-base"
                        data-testid={`pds-buy-ins-sum-${player.id}`}
                      >
                        <span className="font-medium tabular-nums">
                          {formatCents(totalBuyInCents)}
                        </span>
                        <span className="text-muted-foreground">
                          {" · "}
                          {player.buyIns.length === 1
                            ? "1 buy-in"
                            : `${player.buyIns.length} buy-ins`}
                        </span>
                      </p>
                    </div>
                  )}

                  {/* 5. Cash out (last before delete, per UX flow). */}
                  <div className="flex flex-col gap-1">
                    <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Cash out
                    </span>
                    <p className="text-xs text-muted-foreground">
                      What this player walks away with.
                    </p>
                    {cashOutEditable ? (
                      <CurrencyInput
                        id={`pds-cashout-${player.id}`}
                        placeholder="0.00"
                        value={cashOutDraft}
                        onChange={setCashOutDraft}
                        disabled={busy}
                        aria-label="Cash out"
                        className="tabular-nums"
                      />
                    ) : (
                      <>
                        <p
                          className="text-base font-medium tabular-nums"
                          data-testid={`pds-cashout-text-${player.id}`}
                        >
                          {/* `—` (em-dash) is the tabular-empty placeholder for
                              money cells. Intentional financial-UI convention,
                              not the punctuation em-dash banned in prose copy. */}
                          {player.cashOutCents === null
                            ? "—"
                            : formatCents(player.cashOutCents)}
                        </p>
                        {!archived && (
                          <p className="text-xs text-muted-foreground">
                            Cash-out is locked while the session is settling.
                            Roll back to in-progress to edit.
                          </p>
                        )}
                      </>
                    )}
                  </div>

                  {saveError?.kind === "generic" && (
                    <div
                      role="alert"
                      className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive-fg"
                    >
                      {saveError.message}
                    </div>
                  )}

                  {/* 6. Delete player */}
                  {deleteVisible && (
                    <div className="mt-6 border-t border-border pt-4">
                      <Button
                        type="button"
                        variant="destructive"
                        onClick={() => setConfirmingDelete(true)}
                        disabled={busy}
                        data-testid={`pds-delete-${player.id}`}
                        className="w-full"
                      >
                        <Trash2 className="size-4" />
                        Delete player
                      </Button>
                      <p className="mt-2 text-center text-xs text-muted-foreground">
                        This permanently removes their buy-ins and cash-out.
                      </p>
                    </div>
                  )}
                </div>
              </div>
              {/* Submit-on-Enter only — visible Save lives in the header. */}
              <button
                type="submit"
                className="hidden"
                tabIndex={-1}
                aria-hidden="true"
              >
                Save
              </button>
            </form>
          </DialogPrimitive.Popup>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>

      <Dialog
        open={confirmingDelete}
        onOpenChange={(next) => {
          if (!next && deleting) return;
          setConfirmingDelete(next);
          if (!next) setDeleteError(null);
        }}
      >
        <DialogContent
          showCloseButton={false}
          data-testid={`pds-delete-confirm-${player.id}`}
        >
          <DialogHeader>
            <DialogTitle>Delete player?</DialogTitle>
            <DialogDescription>
              Delete {player.name}? This permanently removes their buy-ins and
              cash-out from the session. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {deleteError && (
            <div
              role="alert"
              className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive-fg"
            >
              {deleteError}
            </div>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setConfirmingDelete(false);
                setDeleteError(null);
              }}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => void handleConfirmDelete()}
              disabled={deleting}
            >
              {deleting && <Loader2 className="mr-1 size-4 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmingDiscard} onOpenChange={setConfirmingDiscard}>
        <DialogContent
          showCloseButton={false}
          data-testid={`pds-discard-confirm-${player.id}`}
        >
          <DialogHeader>
            <DialogTitle>Discard changes?</DialogTitle>
            <DialogDescription>
              You have unsaved changes to {player.name}. Leave without saving?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setConfirmingDiscard(false)}
              data-testid={`pds-discard-keep-${player.id}`}
            >
              Keep editing
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                setConfirmingDiscard(false);
                onOpenChange(false);
              }}
              data-testid={`pds-discard-confirm-yes-${player.id}`}
            >
              Discard
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
