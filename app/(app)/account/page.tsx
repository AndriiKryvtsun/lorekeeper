import { AuthShell } from "@/components/auth/auth-shell";
import { UpdatePasswordForm } from "@/components/auth/update-password-form";

export const metadata = { title: "Account · LoreKeeper" };

// Account settings. The set-password form lets magic-link users (who have no password) set
// one; it works for any authenticated user as a password change.
export default function AccountPage() {
  return (
    <div className="max-w-sm space-y-6">
      <h1 className="text-2xl font-semibold">Account</h1>
      <AuthShell
        title="Set a password"
        description="Joined via magic link? Set a password to sign in with email + password."
      >
        <UpdatePasswordForm submitLabel="Set password" />
      </AuthShell>
    </div>
  );
}
