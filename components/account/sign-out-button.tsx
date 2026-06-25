import { LogOut } from "lucide-react";

import { Button } from "@/components/ui/button";
import { signOut } from "@/lib/auth/actions";

// Sign out of the CURRENT session only (local scope), then redirect to sign-in. This is
// deliberately distinct from "sign out of all other devices" (global) on the same page.
export function SignOutButton() {
  return (
    <form action={signOut}>
      <Button type="submit" variant="outline">
        <LogOut aria-hidden="true" />
        Sign out
      </Button>
    </form>
  );
}
