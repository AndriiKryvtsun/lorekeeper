import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";

// Clears the session and returns to the login page.
export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/login", new URL(request.url).origin), {
    status: 303,
  });
}
