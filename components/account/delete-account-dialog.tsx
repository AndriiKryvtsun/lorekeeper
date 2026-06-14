"use client";

import { useActionState } from "react";

import { AuthStatus } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { deleteAccount, type AuthActionState } from "@/lib/auth/actions";

const initial: AuthActionState = { ok: false };

// Irreversible account deletion behind an accessible confirm dialog: requires the typed account
// email AND the current password (reauthentication). The server enforces both.
export function DeleteAccountDialog({ email }: { email: string }) {
  const [state, dispatch, pending] = useActionState(deleteAccount, initial);
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="destructive">Delete account</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete account</DialogTitle>
          <DialogDescription>
            This permanently deletes your account and all of your campaigns and data. This
            action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <form action={dispatch} className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="confirmEmail">Type your email to confirm</Label>
            <Input
              id="confirmEmail"
              name="confirmEmail"
              type="email"
              placeholder={email}
              autoComplete="off"
              required
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="delete-account-password">Current password</Label>
            <Input
              id="delete-account-password"
              name="currentPassword"
              type="password"
              autoComplete="current-password"
              required
            />
          </div>
          <AuthStatus error={state.error} message={state.message} />
          <DialogFooter>
            <Button type="submit" variant="destructive" disabled={pending}>
              {pending ? "Deleting…" : "Permanently delete"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
