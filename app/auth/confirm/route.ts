import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";

// Verifies an email OTP (confirmation, recovery, magic link) carrying `token_hash` + `type`,
// establishes the session via the server client, then redirects onward. Recovery links pass
// `next=/reset-password` so the recovery session lands on the reset page.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const next = url.searchParams.get("next") ?? "/campaigns";

  if (!tokenHash || !type) {
    return NextResponse.redirect(
      new URL("/sign-in?error=invalid_link", url.origin),
    );
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
  if (error) {
    return NextResponse.redirect(
      new URL("/sign-in?error=invalid_link", url.origin),
    );
  }

  return NextResponse.redirect(new URL(next, url.origin));
}
