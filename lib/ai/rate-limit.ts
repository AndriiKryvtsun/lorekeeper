import "server-only";

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

import { env } from "~/env";

// External rate-limit store + daily token budget for the assistant. When Upstash is not
// configured (dev/test), limiting is DISABLED (requests allowed) — production must set the
// Upstash env vars. Keys are namespaced so they never collide with other features.

const PER_USER = { limit: 20, windowSec: 60 } as const;
const PER_IP = { limit: 60, windowSec: 60 } as const;
// Entity-enrichment propose procedures are more expensive (SRD/LLM); limit them tighter.
const PROPOSE_PER_USER = { limit: 10, windowSec: 60 } as const;

let redis: Redis | null = null;
let userLimiter: Ratelimit | null = null;
let ipLimiter: Ratelimit | null = null;
let proposeLimiter: Ratelimit | null = null;

if (env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN) {
  redis = new Redis({
    url: env.UPSTASH_REDIS_REST_URL,
    token: env.UPSTASH_REDIS_REST_TOKEN,
  });
  userLimiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(PER_USER.limit, `${PER_USER.windowSec} s`),
    prefix: "assist:user",
  });
  ipLimiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(PER_IP.limit, `${PER_IP.windowSec} s`),
    prefix: "assist:ip",
  });
  proposeLimiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(PROPOSE_PER_USER.limit, `${PROPOSE_PER_USER.windowSec} s`),
    prefix: "enrich:user",
  });
}

export type RateLimitResult =
  | { ok: true }
  | { ok: false; reason: "user" | "ip" | "budget" };

// Per-IP then per-user sliding-window limits. Disabled (ok) when Upstash is unconfigured.
export async function enforceRateLimits(
  userId: string,
  ip: string,
): Promise<RateLimitResult> {
  if (ipLimiter) {
    const r = await ipLimiter.limit(ip);
    if (!r.success) return { ok: false, reason: "ip" };
  }
  if (userLimiter) {
    const r = await userLimiter.limit(userId);
    if (!r.success) return { ok: false, reason: "user" };
  }
  return { ok: true };
}

// Per-user limit for the entity-enrichment propose procedures. Disabled (ok) when Upstash is
// unconfigured (dev/test). Enforced BEFORE any SRD lookup or LLM call.
export async function enforceProposeRateLimit(
  userId: string,
): Promise<RateLimitResult> {
  if (proposeLimiter) {
    const r = await proposeLimiter.limit(userId);
    if (!r.success) return { ok: false, reason: "user" };
  }
  return { ok: true };
}

function budgetKey(userId: string): string {
  const day = new Date().toISOString().slice(0, 10);
  return `assist:budget:${userId}:${day}`;
}

// True when the user is already at/over today's token budget. Disabled (ok) without Upstash.
export async function isOverDailyBudget(userId: string): Promise<boolean> {
  if (!redis) return false;
  const used = await redis.get<number>(budgetKey(userId));
  return (used ?? 0) >= env.ASSISTANT_DAILY_TOKEN_BUDGET;
}

// Add consumed tokens to today's counter (TTL ~26h). No-op without Upstash.
export async function recordTokenUsage(
  userId: string,
  tokens: number,
): Promise<void> {
  if (!redis || tokens <= 0) return;
  const key = budgetKey(userId);
  await redis.incrby(key, tokens);
  await redis.expire(key, 60 * 60 * 26);
}
