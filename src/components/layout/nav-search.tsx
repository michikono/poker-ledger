"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Input } from "@/components/ui/input";

export function NavSearch() {
  const router = useRouter();
  const [value, setValue] = useState("");

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const q = value.trim();
    router.push(q ? `/sessions?q=${encodeURIComponent(q)}` : "/sessions");
  }

  return (
    <form onSubmit={handleSubmit} className="px-2">
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Search sessions…"
        aria-label="Search sessions"
        className="h-8 text-sm"
      />
    </form>
  );
}
