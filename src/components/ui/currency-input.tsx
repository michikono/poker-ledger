"use client";

import type { ComponentPropsWithoutRef } from "react";
import { parseDollars } from "@/lib/currency/parse";
import { Input } from "./input";

type Props = Omit<
  ComponentPropsWithoutRef<typeof Input>,
  "type" | "inputMode" | "onChange"
> & {
  value: string;
  onChange: (value: string) => void;
};

export function CurrencyInput({
  value,
  onChange,
  onKeyDown,
  onBlur,
  ...props
}: Props) {
  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.metaKey || e.ctrlKey || e.altKey) {
      onKeyDown?.(e);
      return;
    }
    const { key } = e;
    if (key === "." && value.includes(".")) {
      e.preventDefault();
      return;
    }
    if (
      (key >= "0" && key <= "9") ||
      key === "." ||
      key === "Backspace" ||
      key === "Delete" ||
      key === "Tab" ||
      key === "Enter" ||
      key === "Escape" ||
      key.startsWith("Arrow") ||
      key === "Home" ||
      key === "End"
    ) {
      onKeyDown?.(e);
      return;
    }
    e.preventDefault();
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    let raw = e.target.value.replace(/[^0-9.]/g, "");
    const dotIdx = raw.indexOf(".");
    if (dotIdx !== -1) {
      const integer = raw.slice(0, dotIdx);
      const decimal = raw
        .slice(dotIdx + 1)
        .replace(/\./g, "")
        .slice(0, 2);
      raw = `${integer === "" ? "0" : integer}.${decimal}`;
    }
    onChange(raw);
  }

  function handleBlur(e: React.FocusEvent<HTMLInputElement>) {
    if (value !== "") {
      const parsed = parseDollars(value);
      if (parsed !== null) onChange((parsed / 100).toFixed(2));
    }
    onBlur?.(e);
  }

  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    const text = e.clipboardData.getData("text");
    const parsed = parseDollars(text);
    if (parsed !== null) onChange((parsed / 100).toFixed(2));
  }

  return (
    <Input
      {...props}
      type="text"
      inputMode="decimal"
      value={value}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      onBlur={handleBlur}
      onPaste={handlePaste}
    />
  );
}
