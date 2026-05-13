import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("firebase/auth", () => ({
  GoogleAuthProvider: class {},
  signInWithPopup: vi.fn(),
}));

vi.mock("firebase/app", () => ({
  FirebaseError: class extends Error {},
}));

vi.mock("@/lib/firebase/client", () => ({
  getClientAuth: () => ({
    authStateReady: () => Promise.resolve(),
  }),
}));

vi.mock("./actions", () => ({
  createSession: vi.fn(),
}));

import { isSafeInternalPath, SignInForm } from "./sign-in-form";

describe("SignInForm — heading hierarchy", () => {
  // Spec 0020: sign-in page must expose a real <h1> so screen readers
  // don't start at rank 0. CardTitle (a <div>) is not enough.
  it("renders exactly one h1 with the project name", () => {
    render(<SignInForm />);
    const headings = screen.getAllByRole("heading", { level: 1 });
    expect(headings).toHaveLength(1);
    expect(headings[0]).toHaveTextContent("Poker Ledger");
  });
});

describe("isSafeInternalPath", () => {
  it("accepts a simple internal path", () => {
    expect(isSafeInternalPath("/sessions")).toBe(true);
  });

  it("accepts a deep-link with search params", () => {
    expect(isSafeInternalPath("/sessions/abc?help=rules")).toBe(true);
  });

  it("accepts a path with multiple search params", () => {
    expect(isSafeInternalPath("/sessions?status=in_progress&page=2")).toBe(
      true,
    );
  });

  it("rejects empty string", () => {
    expect(isSafeInternalPath("")).toBe(false);
  });

  it("rejects paths that don't start with a slash", () => {
    expect(isSafeInternalPath("sessions")).toBe(false);
    expect(isSafeInternalPath("evil.com")).toBe(false);
  });

  it("rejects protocol-relative URLs (// → external host)", () => {
    expect(isSafeInternalPath("//evil.com/foo")).toBe(false);
    expect(isSafeInternalPath("//evil.com")).toBe(false);
  });

  it("rejects absolute URLs with explicit protocols", () => {
    expect(isSafeInternalPath("https://evil.com/foo")).toBe(false);
    expect(isSafeInternalPath("http://evil.com")).toBe(false);
    expect(isSafeInternalPath("javascript://evil")).toBe(false);
  });

  it("rejects backslash-prefixed paths (some browsers normalise to //)", () => {
    expect(isSafeInternalPath("/\\evil.com")).toBe(false);
    expect(isSafeInternalPath("/\\\\evil.com")).toBe(false);
  });

  it("rejects pathologically long inputs", () => {
    expect(isSafeInternalPath(`/${"a".repeat(1001)}`)).toBe(false);
  });
});
