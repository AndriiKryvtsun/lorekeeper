import { createBrowserClient } from "@supabase/ssr";

import { env } from "~/env";

// Browser Supabase client. Uses ONLY the public anon key — the service-role key must
// never be referenced in client code.
export function createSupabaseBrowserClient() {
  return createBrowserClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}
