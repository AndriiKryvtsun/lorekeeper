import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { getCurrentUser } from "@/lib/auth/getCurrentUser";

// Signed-in users never see the auth pages (defense-in-depth behind the proxy).
export default async function AuthLayout({
  children,
}: {
  children: ReactNode;
}) {
  const user = await getCurrentUser();
  if (user) {
    redirect("/campaigns");
  }
  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-sm flex-col justify-center py-10">
      {children}
    </div>
  );
}
