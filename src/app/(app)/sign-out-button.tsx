"use client";

import { signOut } from "@/app/sign-in/actions";

export default function SignOutButton() {
  return (
    <button type="button" onClick={() => signOut()}>
      Sign out
    </button>
  );
}
