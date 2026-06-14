import "server-only";

import { createClient } from "@supabase/supabase-js";

import { env } from "~/env";

// Service-role Supabase client — SERVER ONLY. Used solely for privileged admin operations
// (e.g. `auth.admin.deleteUser`). The service-role key must NEVER reach the client or logs.
// No session persistence/refresh: this client is used for one-off admin calls.
export function createSupabaseAdminClient() {
  if (!env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured");
  }
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
