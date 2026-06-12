import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";

// Clears the session and returns to the sign-in page.
export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(
    new URL("/sign-in", new URL(request.url).origin),
    { status: 303 },
  );
}
