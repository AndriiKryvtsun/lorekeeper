import { NextResponse } from "next/server";

import { processPendingSummaries } from "@/lib/summaries/worker";
import { env } from "~/env";

// Node runtime: the Prisma pg adapter and the provider port are not Edge-safe.
export const runtime = "nodejs";
export const maxDuration = 60;

// Fail-closed: the worker runs ONLY for callers presenting the configured cron secret. Vercel
// Cron sends it as `Authorization: Bearer <CRON_SECRET>`. This is not a user request path.
function authorized(req: Request): boolean {
  if (!env.CRON_SECRET) return false;
  return req.headers.get("authorization") === `Bearer ${env.CRON_SECRET}`;
}

async function handle(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await processPendingSummaries();
  return NextResponse.json({ ok: true, ...result });
}

// Vercel Cron issues GET; POST is accepted for manual/local triggering.
export const GET = handle;
export const POST = handle;
