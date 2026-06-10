import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";

// Completes sign-in: exchanges the auth code for a session and sets the session cookies,
// then redirects to the post-login destination.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const redirectTo = url.searchParams.get("redirectTo") ?? "/";

  if (!code) {
    return NextResponse.redirect(new URL("/login?error=missing_code", url.origin));
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(new URL("/login?error=auth", url.origin));
  }

  return NextResponse.redirect(new URL(redirectTo, url.origin));
}
