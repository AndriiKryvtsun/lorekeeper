import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { getCurrentUser } from "@/lib/auth/getCurrentUser";

// Auth guard for all authenticated screens. Defense-in-depth behind the proxy: server
// components under this group never render for an anonymous user.
export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/sign-in");
  }
  return <>{children}</>;
}
