import { AuthShell } from "@/components/auth/auth-shell";
import { SignInForm } from "@/components/auth/sign-in-form";

export const metadata = { title: "Sign in · LoreKeeper" };

export default function SignInPage() {
  return (
    <AuthShell title="Sign in" description="Welcome back to LoreKeeper.">
      <SignInForm />
    </AuthShell>
  );
}
