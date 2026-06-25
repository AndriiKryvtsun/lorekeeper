"use client";

import { ChevronsUpDown, LogOut, Moon, Sun, User } from "lucide-react";
import { useTheme } from "next-themes";
import Link from "next/link";
import { useEffect, useState } from "react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { signOut } from "@/lib/auth/actions";
import { cn } from "@/lib/utils";

function initials(name: string | null | undefined, email: string | null | undefined): string {
  const source = name?.trim() || email?.trim() || "";
  if (!source) return "?";
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return source.slice(0, 2).toUpperCase();
}

// Accessible avatar dropdown in the app-shell header. Read-only: it renders the signed-in
// user's profile data without mutating anything. Radix supplies menu/menuitem roles, roving
// focus, type-ahead, Escape, and focus return to the trigger on close.
export function UserMenu({
  displayName,
  email,
  avatarUrl,
}: {
  displayName?: string | null;
  email?: string | null;
  avatarUrl?: string | null;
}) {
  const { resolvedTheme, setTheme } = useTheme();
  // Avoid a hydration mismatch: the resolved theme is only known on the client.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const isDark = mounted && resolvedTheme === "dark";

  const label = displayName?.trim() || email || "Account";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Open user menu"
        className={cn(
          "inline-flex items-center gap-2 rounded-full p-1 pr-2 text-sm transition-colors",
          "hover:bg-accent hover:text-accent-foreground",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        )}
      >
        <Avatar>
          {avatarUrl ? <AvatarImage src={avatarUrl} alt="" /> : null}
          <AvatarFallback>{initials(displayName, email)}</AvatarFallback>
        </Avatar>
        <span className="hidden max-w-[16ch] truncate sm:inline">{label}</span>
        <ChevronsUpDown aria-hidden="true" className="size-4 text-muted-foreground" />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end">
        <DropdownMenuLabel>
          <span className="block truncate font-medium">{label}</span>
          {email ? (
            <span className="block truncate text-xs font-normal text-muted-foreground">
              {email}
            </span>
          ) : null}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        <DropdownMenuItem asChild>
          <Link href="/account">
            <User aria-hidden="true" />
            Profile
          </Link>
        </DropdownMenuItem>

        {/* Theme toggle: preventDefault keeps the menu open after switching. */}
        <DropdownMenuItem
          onSelect={(event) => {
            event.preventDefault();
            setTheme(isDark ? "light" : "dark");
          }}
        >
          {isDark ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
          {isDark ? "Light theme" : "Dark theme"}
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        {/* Sign out of the CURRENT session (local scope) via a Server Action. The submit
            button IS the menuitem, so selecting it submits the form. */}
        <form action={signOut}>
          <DropdownMenuItem asChild>
            <button type="submit" className="w-full">
              <LogOut aria-hidden="true" />
              Sign out
            </button>
          </DropdownMenuItem>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
