import type { ReactNode } from "react";

import { AvatarUploader } from "@/components/account/avatar-uploader";
import { DeleteAccountDialog } from "@/components/account/delete-account-dialog";
import { ProfileForm } from "@/components/account/profile-form";
import { SignOutButton } from "@/components/account/sign-out-button";
import { SignOutOthersButton } from "@/components/account/sign-out-others-button";
import { AuthShell } from "@/components/auth/auth-shell";
import { UpdatePasswordForm } from "@/components/auth/update-password-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { api } from "~/trpc/server";

export const metadata = { title: "Account · LoreKeeper" };

// Account & profile settings. Everything is the current user's OWN data — the (app) layout
// guarantees an authenticated user, and every action is scoped to ctx.user.id server-side.
export default async function AccountPage() {
  const [user, profile] = await Promise.all([
    getCurrentUser(),
    api.profile.getMyProfile(),
  ]);
  const email = user?.email ?? "";

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <h1 className="text-2xl font-semibold">Account</h1>

      <Section title="Profile">
        <AvatarUploader userId={user?.id ?? ""} initialUrl={profile?.avatarUrl ?? null} />
        <ProfileForm
          initial={{ displayName: profile?.displayName ?? null, bio: profile?.bio ?? null }}
        />
      </Section>

      <Section title="Security">
        <AuthShell
          title="Set / change password"
          description="Magic-link users can set a password; this also changes an existing one. Changing it signs you out everywhere."
        >
          <UpdatePasswordForm submitLabel="Update password" />
        </AuthShell>
      </Section>

      <Section title="Sessions">
        <div className="space-y-1">
          <p className="text-sm font-medium">This session</p>
          <p className="text-sm text-muted-foreground">
            Sign out on this device only. Your other devices stay signed in.
          </p>
          <div className="pt-1">
            <SignOutButton />
          </div>
        </div>
        <div className="space-y-1 border-t border-border pt-4">
          <p className="text-sm font-medium">Other devices</p>
          <p className="text-sm text-muted-foreground">
            Sign out everywhere else. This device stays signed in.
          </p>
          <div className="pt-1">
            <SignOutOthersButton />
          </div>
        </div>
      </Section>

      <Section title="Danger zone">
        <p className="text-sm text-muted-foreground">
          Permanently delete your account and all of your data. This cannot be undone.
        </p>
        <DeleteAccountDialog email={email} />
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  );
}
