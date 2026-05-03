"use client";

import { SessionSearchInput } from "@/components/sessions/session-search-input";

type Props = {
  onSelect?: () => void;
};

export function NavSearch({ onSelect }: Props) {
  return (
    <SessionSearchInput {...(onSelect ? { onSelect } : {})} className="px-2" />
  );
}
