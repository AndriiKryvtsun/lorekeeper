import { createBrowserClient } from "@supabase/ssr";

// Browser Supabase client. Uses ONLY the public anon key — the service-role key must
// never be referenced in client code.
export function createSupabaseBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set",
    );
  }
  return createBrowserClient(url, anonKey);
}
