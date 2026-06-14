import { createServerClient } from "@supabase/ssr";
import type { CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { env } from "~/env";

// Next.js 16 "Proxy" convention (formerly Middleware). Refreshes the Supabase session and
// protects every route except the public (auth) pages and /auth/* handlers. Signed-in users
// are kept out of the auth pages.

// Auth pages off-limits once signed in. NOTE: /reset-password is intentionally excluded —
// a recovery session is "authenticated" but must be allowed to reach the reset page.
const REDIRECT_WHEN_AUTHED = ["/sign-in", "/sign-up", "/forgot-password"];
// Public routes reachable without a session: the home page, the auth pages, reset-password,
// and /auth/*. NOTE: "/" matches the root exactly (the prefix form "//" matches nothing), so
// it does not make every route public. The home route itself redirects authed users to
// /campaigns server-side.
const PUBLIC_PATHS = [
  "/",
  ...REDIRECT_WHEN_AUTHED,
  "/reset-password",
  "/auth",
];

function matches(pathname: string, paths: string[]): boolean {
  return paths.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

function isPublic(pathname: string): boolean {
  return matches(pathname, PUBLIC_PATHS);
}

function isAuthPage(pathname: string): boolean {
  return matches(pathname, REDIRECT_WHEN_AUTHED);
}

function hardenedCookieOptions(options: CookieOptions): CookieOptions {
  return { ...options, httpOnly: true, secure: true, sameSite: "lax" };
}

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, hardenedCookieOptions(options));
        });
      },
    },
  });

  // Refreshes the session and returns the current user.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // Signed-in users should never see the auth pages — send them into the app.
  if (user && isAuthPage(pathname)) {
    const appUrl = request.nextUrl.clone();
    appUrl.pathname = "/campaigns";
    appUrl.search = "";
    return NextResponse.redirect(appUrl);
  }

  if (!user && !isPublic(pathname)) {
    // API routes are rejected with 401; page routes redirect to sign-in.
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const signInUrl = request.nextUrl.clone();
    signInUrl.pathname = "/sign-in";
    signInUrl.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(signInUrl);
  }

  return response;
}

export const config = {
  // Run on every route except Next.js internals and static asset files.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
