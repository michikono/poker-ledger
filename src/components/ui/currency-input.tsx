"use client";

import type { ComponentPropsWithoutRef } from "react";
import { parseDollars } from "@/lib/currency/parse";
import { Input } from "./input";

const MAX_CENTS = 9_999_999; // $99,999.99

type Props = Omit<
  ComponentPropsWithoutRef<typeof Input>,
  "type" | "inputMode" | "onChange"
> & {
  value: string;
  onChange: (value: string) => void;
};

function centsToDisplay(cents: number): string {
  return cents > 0 ? (cents / 100).toFixed(2) : "";
}

export function CurrencyInput({ value, onChange, onKeyDown, ...props }: Props) {
  const cents = parseDollars(value) ?? 0;

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    // Pass navigation/modifier keys through to caller
    if (
      e.key === "Tab" ||
      e.key === "Enter" ||
      e.key === "Escape" ||
      e.key.startsWith("Arrow") ||
      e.key === "Home" ||
      e.key === "End" ||
      e.metaKey ||
      e.ctrlKey ||
      e.altKey
    ) {
      onKeyDown?.(e);
      return;
    }

    e.preventDefault();

    if (e.key >= "0" && e.key <= "9") {
      const input = e.currentTarget;
      // If the user has selected all text and types, start fresh
      const isAllSelected =
        input.selectionStart === 0 &&
        input.selectionEnd === input.value.length &&
        input.value.length > 0;
      const baseCents = isAllSelected ? 0 : cents;
      const digit = Number.parseInt(e.key, 10);
      onChange(centsToDisplay(Math.min(baseCents * 10 + digit, MAX_CENTS)));
    } else if (e.key === "Backspace" || e.key === "Delete") {
      onChange(centsToDisplay(Math.floor(cents / 10)));
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    // Handles fireEvent.change in tests and direct DOM mutations
    const raw = e.target.value;
    if (raw === "") {
      onChange("");
      return;
    }
    const parsed = parseDollars(raw);
    if (parsed !== null) {
      onChange(centsToDisplay(Math.min(parsed, MAX_CENTS)));
    }
  }

  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    const text = e.clipboardData.getData("text");
    const parsed = parseDollars(text);
    if (parsed !== null) {
      onChange(centsToDisplay(Math.min(parsed, MAX_CENTS)));
    }
  }

  return (
    <Input
      {...props}
      type="text"
      inputMode="numeric"
      value={value}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      onPaste={handlePaste}
    />
  );
}
