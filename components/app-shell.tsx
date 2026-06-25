import Link from "next/link";
import type { ReactNode } from "react";

import { UserMenu } from "@/components/user-menu";

// Responsive authenticated app shell: skip link + banner header, primary nav, and the
// main content region. Semantic landmarks (header/banner, nav, main) are explicit. The
// header surfaces the signed-in user via an accessible avatar dropdown (UserMenu).
export function AppShell({
  children,
  displayName,
  email,
  avatarUrl,
}: {
  children: ReactNode;
  displayName?: string | null;
  email?: string | null;
  avatarUrl?: string | null;
}) {
  return (
    <>
      {/* Skip-to-content: visually hidden until focused, then jumps to #main. */}
      <a
        href="#main"
        className="sr-only rounded-md bg-primary px-4 py-2 text-primary-foreground focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100]"
      >
        Skip to content
      </a>

      <div className="flex min-h-full flex-col">
        <header className="border-b border-border bg-background/80 backdrop-blur">
          <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-3">
            <Link
              href="/"
              className="font-display text-lg font-semibold tracking-tight"
            >
              LoreKeeper
            </Link>
            <nav aria-label="Primary" className="flex items-center gap-1">
              <Link
                href="/campaigns"
                className="rounded-md px-3 py-2 text-sm transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                Campaigns
              </Link>
              <UserMenu
                displayName={displayName}
                email={email}
                avatarUrl={avatarUrl}
              />
            </nav>
          </div>
        </header>

        <main
          id="main"
          tabIndex={-1}
          className="lk-animate-fade mx-auto w-full max-w-6xl flex-1 px-4 py-6"
        >
          {children}
        </main>
      </div>
    </>
  );
}
