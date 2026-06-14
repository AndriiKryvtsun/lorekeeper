"use client";

import { useActionState } from "react";

import { AuthStatus } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { signOutOtherDevices, type AuthActionState } from "@/lib/auth/actions";

const initial: AuthActionState = { ok: false };

// Revoke the user's other sessions (keeps this device signed in).
export function SignOutOthersButton() {
  const [state, dispatch, pending] = useActionState(
    () => signOutOtherDevices(),
    initial,
  );
  return (
    <form action={dispatch} className="space-y-2">
      <Button type="submit" variant="outline" disabled={pending}>
        {pending ? "Signing out…" : "Sign out of all other devices"}
      </Button>
      <AuthStatus error={state.error} message={state.message} />
    </form>
  );
}
