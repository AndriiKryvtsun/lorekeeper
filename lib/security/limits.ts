import "server-only";

import {
  enforceRateLimits,
  isOverDailyBudget,
  recordTokenUsage,
} from "@/lib/ai/rate-limit";

// One boundary surface for request-size and rate limits. The Upstash-backed limiter lives in
// lib/ai/rate-limit (the impl); this module is the single place handlers reach for limits.
export { enforceRateLimits, isOverDailyBudget, recordTokenUsage };

export const MAX_REQUEST_BYTES = 32 * 1024;

export function isOverRequestSize(req: Request, maxBytes = MAX_REQUEST_BYTES): boolean {
  const len = Number(req.headers.get("content-length") ?? "0");
  return Number.isFinite(len) && len > maxBytes;
}

export type BoundaryResult = { ok: true } | { ok: false; status: number; reason: string };

// Enforce size then per-IP/per-user rate limits at the request boundary, before handler logic.
export async function enforceRequestBoundary(args: {
  req: Request;
  userId: string;
  ip: string;
  maxBytes?: number;
}): Promise<BoundaryResult> {
  if (isOverRequestSize(args.req, args.maxBytes)) {
    return { ok: false, status: 413, reason: "too_large" };
  }
  const rl = await enforceRateLimits(args.userId, args.ip);
  if (!rl.ok) return { ok: false, status: 429, reason: `rate_limit:${rl.reason}` };
  return { ok: true };
}
