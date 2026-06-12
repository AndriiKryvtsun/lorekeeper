import { AuthShell } from "@/components/auth/auth-shell";
import { SignUpForm } from "@/components/auth/sign-up-form";

export const metadata = { title: "Sign up · LoreKeeper" };

export default function SignUpPage() {
  return (
    <AuthShell title="Create your account" description="Start keeping your lore.">
      <SignUpForm />
    </AuthShell>
  );
}
