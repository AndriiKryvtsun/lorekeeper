import { AuthShell } from "@/components/auth/auth-shell";
import { UpdatePasswordForm } from "@/components/auth/update-password-form";

export const metadata = { title: "Set a new password · LoreKeeper" };

// Top-level (not under the (auth) redirect-authed layout) because a recovery session is
// authenticated and must be allowed here. The updatePassword action refuses without a
// valid session, so a direct visit without a recovery session cannot change a password.
export default function ResetPasswordPage() {
  return (
    <main
      id="main"
      className="mx-auto flex min-h-[70vh] w-full max-w-sm flex-col justify-center py-10"
    >
      <AuthShell
        title="Set a new password"
        description="Choose a new password for your account."
      >
        <UpdatePasswordForm submitLabel="Update password" />
      </AuthShell>
    </main>
  );
}
