import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { AppShell } from "@/components/app-shell";
import { AssistantWidget } from "@/components/assistant/assistant-widget";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { getProfile } from "@/lib/data/profile";

// Auth guard + app shell for all authenticated screens. Defense-in-depth behind the proxy:
// server components under this group never render for an anonymous user. The shell (header,
// nav, skip link, main landmark) is scoped here so public pages (landing, auth) are not
// wrapped in app chrome.
export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/sign-in");
  }
  // The header user menu shows the user's avatar + display name (read-only profile data).
  const profile = await getProfile(user.id);
  // The assistant launcher lives at the layout root (sibling of the shell) so it persists
  // across in-app navigation and overlays the page without being inside the main landmark.
  return (
    <>
      <AppShell
        displayName={profile?.displayName ?? null}
        email={user.email ?? null}
        avatarUrl={profile?.avatarUrl ?? null}
      >
        {children}
      </AppShell>
      <AssistantWidget />
    </>
  );
}
