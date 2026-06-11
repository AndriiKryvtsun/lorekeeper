import "server-only";

import { createServerClient } from "@supabase/ssr";
import type { CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

import { env } from "~/env";

// Session cookies are hardened per spec: not readable by client JS, only sent over
// HTTPS, and not sent on cross-site requests.
function hardenedCookieOptions(options: CookieOptions): CookieOptions {
  return { ...options, httpOnly: true, secure: true, sameSite: "lax" };
}

// Server-side Supabase client wired to the request cookies. Uses the public anon key;
// the service-role key is never used here.
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        // In Server Components cookie writes throw; middleware refreshes the session,
        // so we can safely ignore that case here.
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, hardenedCookieOptions(options));
          });
        } catch {
          // No-op: called from a context where cookies are read-only.
        }
      },
    },
  });
}
