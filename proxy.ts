import { createServerClient } from "@supabase/ssr";
import type { CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import {
  buildContentSecurityPolicy,
  generateNonce,
  SECURITY_HEADERS,
} from "@/lib/security/headers";
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

function supabaseOrigin(): string | null {
  try {
    return new URL(env.NEXT_PUBLIC_SUPABASE_URL).origin;
  } catch {
    return null;
  }
}

export async function proxy(request: NextRequest) {
  // Per-request nonce + CSP. Forward them on the REQUEST headers so Next applies the nonce to
  // its own scripts; also set them (plus the static hardening headers) on every response.
  const nonce = generateNonce();
  const csp = buildContentSecurityPolicy({
    nonce,
    supabaseOrigin: supabaseOrigin(),
    dev: env.NODE_ENV !== "production",
  });
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("content-security-policy", csp);

  const withSecurityHeaders = (res: NextResponse): NextResponse => {
    res.headers.set("content-security-policy", csp);
    for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
      res.headers.set(name, value);
    }
    return res;
  };

  let response = NextResponse.next({ request: { headers: requestHeaders } });

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
        response = NextResponse.next({ request: { headers: requestHeaders } });
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
    return withSecurityHeaders(NextResponse.redirect(appUrl));
  }

  if (!user && !isPublic(pathname)) {
    // API routes are rejected with 401; page routes redirect to sign-in.
    if (pathname.startsWith("/api/")) {
      return withSecurityHeaders(
        NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      );
    }
    const signInUrl = request.nextUrl.clone();
    signInUrl.pathname = "/sign-in";
    signInUrl.searchParams.set("redirectTo", pathname);
    return withSecurityHeaders(NextResponse.redirect(signInUrl));
  }

  return withSecurityHeaders(response);
}

export const config = {
  // Run on every route except Next.js internals and static asset files.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
