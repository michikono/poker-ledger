"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { StatusBadge } from "@/components/status-badge";
import { Input } from "@/components/ui/input";
import { getClientAuth } from "@/lib/firebase/client";
import { cn } from "@/lib/utils";
import type { SearchResult } from "@/app/api/sessions/search/route";

const DEBOUNCE_MS = 300;
const MIN_QUERY_LENGTH = 2;

type DropdownProps = {
  results: SearchResult[];
  activeIndex: number;
  navigate: (name: string) => void;
};

function SearchDropdown({ results, activeIndex, navigate }: DropdownProps) {
  return (
    <div
      id="session-search-listbox"
      role="listbox"
      tabIndex={-1}
      className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md"
    >
      {results.map((result, i) => (
        <div
          key={result.name}
          role="option"
          aria-selected={i === activeIndex}
          tabIndex={-1}
          onMouseDown={(e) => {
            e.preventDefault();
            navigate(result.name);
          }}
          className={cn(
            "flex cursor-pointer items-center justify-between gap-2 px-3 py-2 text-sm",
            i === activeIndex
              ? "bg-accent text-accent-foreground"
              : "hover:bg-accent/50",
          )}
        >
          <span className="truncate">{result.name}</span>
          <StatusBadge status={result.status} />
        </div>
      ))}
    </div>
  );
}

type Props = {
  onSelect?: () => void;
  placeholder?: string;
  className?: string;
};

export function SessionSearchInput({
  onSelect,
  placeholder = "Search sessions…",
  className,
}: Props) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const hadResultsRef = useRef(false);

  useEffect(() => {
    if (query.length < MIN_QUERY_LENGTH) {
      setResults([]);
      setOpen(false);
      setActiveIndex(-1);
      hadResultsRef.current = false;
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);

    const delay = hadResultsRef.current ? 0 : DEBOUNCE_MS;
    debounceRef.current = setTimeout(async () => {
      if (abortRef.current) abortRef.current.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      const token = (await getClientAuth().currentUser?.getIdToken()) ?? "";
      if (!token) return;

      try {
        const res = await fetch(
          `/api/sessions/search?q=${encodeURIComponent(query)}`,
          {
            headers: { Authorization: `Bearer ${token}` },
            signal: controller.signal,
          },
        );
        if (!res.ok) return;
        const data: SearchResult[] = await res.json();
        setResults(data);
        setOpen(data.length > 0);
        setActiveIndex(-1);
        if (data.length > 0) hadResultsRef.current = true;
      } catch {
        // aborted or network error — ignore
      }
    }, delay);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  function navigate(name: string) {
    setQuery("");
    setOpen(false);
    setActiveIndex(-1);
    onSelect?.();
    router.push(`/sessions/${name}`);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || results.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (i <= 0 ? results.length - 1 : i - 1));
    } else if (e.key === "Enter" && activeIndex >= 0) {
      e.preventDefault();
      const result = results[activeIndex];
      if (result) navigate(result.name);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
    }
  }

  return (
    <div className={cn("relative", className)}>
      <Input
        role="combobox"
        aria-controls="session-search-listbox"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-autocomplete="list"
        aria-label="Search sessions"
        placeholder={placeholder}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={handleKeyDown}
        className="h-8 text-sm"
        autoComplete="off"
      />
      {open && (
        <SearchDropdown
          results={results}
          activeIndex={activeIndex}
          navigate={navigate}
        />
      )}
    </div>
  );
}
