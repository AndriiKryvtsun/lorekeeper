import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";

// Establishes a session from an email link, then redirects onward. Handles BOTH email link
// styles so it works regardless of the Supabase email-template configuration:
//   - token_hash + type  → verifyOtp (custom "{token_hash}&type=..." template, cross-device)
//   - code               → exchangeCodeForSession (default PKCE template)
// Recovery links pass `next=/reset-password` so the recovery session lands on the reset page.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/campaigns";

  const invalid = NextResponse.redirect(
    new URL("/sign-in?error=invalid_link", url.origin),
  );

  const supabase = await createSupabaseServerClient();

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (error) return invalid;
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return invalid;
  } else {
    return invalid;
  }

  return NextResponse.redirect(new URL(next, url.origin));
}
