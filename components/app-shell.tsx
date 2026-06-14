import { UserCircle } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { ThemeToggle } from "@/components/theme-toggle";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Responsive authenticated app shell: skip link + banner header, primary nav, and the
// main content region. Semantic landmarks (header/banner, nav, main) are explicit.
// `displayName` (when set) labels the account link in the header.
export function AppShell({
  children,
  displayName,
}: {
  children: ReactNode;
  displayName?: string | null;
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
        <header className="border-b border-border">
          <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-3">
            <Link href="/" className="font-semibold">
              LoreKeeper
            </Link>
            <nav aria-label="Primary" className="flex items-center gap-1">
              <Link
                href="/campaigns"
                className="rounded-md px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground"
              >
                Campaigns
              </Link>
              <Link
                href="/account"
                aria-label="Account settings"
                title="Account settings"
                className={cn(
                  buttonVariants({ variant: "ghost", size: "sm" }),
                  "gap-2",
                )}
              >
                <UserCircle aria-hidden className="size-4" />
                {displayName ? (
                  <span className="max-w-[14ch] truncate">{displayName}</span>
                ) : null}
              </Link>
              <ThemeToggle />
            </nav>
          </div>
        </header>

        <main id="main" tabIndex={-1} className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
          {children}
        </main>
      </div>
    </>
  );
}
