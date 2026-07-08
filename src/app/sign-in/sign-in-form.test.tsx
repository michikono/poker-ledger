import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("firebase/auth", () => ({
  GoogleAuthProvider: class {},
  getRedirectResult: vi.fn(),
  signInWithPopup: vi.fn(),
  signInWithRedirect: vi.fn(),
}));

vi.mock("firebase/app", () => ({
  FirebaseError: class extends Error {
    code: string;
    constructor(code: string) {
      super(code);
      this.code = code;
    }
  },
}));

vi.mock("@/lib/firebase/client", () => ({
  getClientAuth: () => ({
    authStateReady: () => Promise.resolve(),
  }),
}));

vi.mock("./actions", () => ({
  createSession: vi.fn(),
}));

import { FirebaseError } from "firebase/app";
import {
  getRedirectResult,
  signInWithPopup,
  signInWithRedirect,
} from "firebase/auth";
import {
  classifyPopupError,
  isSafeInternalPath,
  SignInForm,
} from "./sign-in-form";
import { createSession } from "./actions";

const fbError = (code: string) =>
  new (FirebaseError as unknown as new (code: string) => FirebaseError)(code);

const mockGetRedirectResult = vi.mocked(getRedirectResult);
const mockSignInWithPopup = vi.mocked(signInWithPopup);
const mockSignInWithRedirect = vi.mocked(signInWithRedirect);
const mockCreateSession = vi.mocked(createSession);

beforeEach(() => {
  vi.clearAllMocks();
  // Default: no pending redirect (the common page-load case).
  mockGetRedirectResult.mockResolvedValue(null);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("classifyPopupError", () => {
  it("classifies user-dismissed popups as silent", () => {
    for (const code of [
      "auth/popup-closed-by-user",
      "auth/cancelled-popup-request",
      "auth/user-cancelled",
    ]) {
      expect(classifyPopupError(fbError(code))).toBe("silent");
    }
  });

  it("classifies popup-unavailable errors as redirect", () => {
    for (const code of [
      "auth/popup-blocked",
      "auth/operation-not-supported-in-this-environment",
      "auth/web-storage-unsupported",
    ]) {
      expect(classifyPopupError(fbError(code))).toBe("redirect");
    }
  });

  it("classifies other Firebase errors as error", () => {
    expect(classifyPopupError(fbError("auth/network-request-failed"))).toBe(
      "error",
    );
  });

  it("classifies non-FirebaseError values as error", () => {
    expect(classifyPopupError(new Error("boom"))).toBe("error");
    expect(classifyPopupError("nope")).toBe("error");
    expect(classifyPopupError(null)).toBe("error");
  });
});

describe("SignInForm — redirect completion on mount", () => {
  it("completes sign-in when getRedirectResult returns a user", async () => {
    mockGetRedirectResult.mockResolvedValue({
      user: { getIdToken: () => Promise.resolve("redir-token") },
    } as never);

    render(<SignInForm />);

    await waitFor(() => {
      expect(mockCreateSession).toHaveBeenCalledWith("redir-token");
    });
    expect(push).toHaveBeenCalledWith("/sessions");
  });

  it("does nothing when getRedirectResult returns null", async () => {
    render(<SignInForm />);

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Continue with Google" }),
      ).toBeEnabled();
    });
    expect(mockCreateSession).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });
});

describe("SignInForm — click handling", () => {
  it("completes sign-in via popup on click", async () => {
    mockSignInWithPopup.mockResolvedValue({
      user: { getIdToken: () => Promise.resolve("popup-token") },
    } as never);

    render(<SignInForm />);
    const button = await screen.findByRole("button", {
      name: "Continue with Google",
    });
    await userEvent.click(button);

    await waitFor(() => {
      expect(mockCreateSession).toHaveBeenCalledWith("popup-token");
    });
    expect(push).toHaveBeenCalledWith("/sessions");
    expect(mockSignInWithRedirect).not.toHaveBeenCalled();
  });

  it("falls back to redirect when the popup is unavailable", async () => {
    mockSignInWithPopup.mockRejectedValue(fbError("auth/popup-blocked"));

    render(<SignInForm />);
    const button = await screen.findByRole("button", {
      name: "Continue with Google",
    });
    await userEvent.click(button);

    await waitFor(() => {
      expect(mockSignInWithRedirect).toHaveBeenCalledTimes(1);
    });
    expect(mockCreateSession).not.toHaveBeenCalled();
  });
});

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
