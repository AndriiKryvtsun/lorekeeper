import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

// The single source of environment access for application runtime code. Validates all
// server-only and NEXT_PUBLIC_ variables with Zod and fails fast on a missing/invalid
// value. Application modules import from `~/env` instead of reading `process.env`.
// (Prisma CLI tooling in `prisma.config.ts` runs before the app boots and is exempt.)
export const env = createEnv({
  server: {
    DATABASE_URL: z.string().url(),
    DIRECT_URL: z.string().url(),
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    // SDK ping reference capability: active provider + optional comma-separated fallback.
    // Consumed only inside lib/sdk/server.
    PING_PROVIDER: z.string().min(1).default("a"),
    PING_FALLBACK: z.string().optional(),
    // SRD lookup capability: active provider + optional comma-separated fallback, and the
    // provider base URLs. Consumed only inside lib/sdk/server. Defaults to the public APIs.
    SRD_PROVIDER: z.string().min(1).default("open5e"),
    SRD_FALLBACK: z.string().optional(),
    OPEN5E_BASE_URL: z.string().url().default("https://api.open5e.com"),
    DND5EAPI_BASE_URL: z.string().url().default("https://www.dnd5eapi.co/api"),
    // LLM capability: active provider + model (+ optional comma-separated fallback).
    // Consumed only inside lib/ai. Switching provider/model is an env change, not code.
    AI_PROVIDER: z.string().min(1).default("anthropic"),
    AI_MODEL: z.string().min(1).default("claude-opus-4-8"),
    AI_FALLBACK: z.string().optional(),
    // Provider API keys are server-only and read only inside lib/ai. Optional so the app
    // builds without them; the relevant adapter throws at call time if its key is absent.
    ANTHROPIC_API_KEY: z.string().min(1).optional(),
    OPENAI_API_KEY: z.string().min(1).optional(),
    GROQ_API_KEY: z.string().min(1).optional(),
    // Assistant model tiers (lib/ai). Cheap classify → mid answer → high reasoning.
    AI_MODEL_CLASSIFY: z.string().min(1).default("claude-haiku-4-5"),
    AI_MODEL_ANSWER: z.string().min(1).default("claude-sonnet-4-6"),
    AI_MODEL_REASONING: z.string().min(1).default("claude-opus-4-8"),
    // External rate-limit store (Upstash Redis). Optional: when unset, limiting is disabled
    // (dev/test). Read only inside lib/ai.
    UPSTASH_REDIS_REST_URL: z.string().url().optional(),
    UPSTASH_REDIS_REST_TOKEN: z.string().min(1).optional(),
    // Per-user daily token budget for the assistant.
    ASSISTANT_DAILY_TOKEN_BUDGET: z.coerce.number().int().positive().default(100_000),
    // Shared secret for the scheduled summary worker route. When unset, the route refuses
    // all calls (fail-closed). Read only by the cron route.
    CRON_SECRET: z.string().min(1).optional(),
  },
  client: {
    NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
    // Cloudflare Turnstile site key (public). Optional: the widget falls back to the
    // Turnstile always-pass test key when unset so dev/test work without configuration.
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: z.string().min(1).optional(),
    // Public site origin used for canonical/Open Graph URLs (metadataBase). Optional;
    // defaults to localhost so dev/build work without configuration.
    NEXT_PUBLIC_SITE_URL: z.string().url().optional(),
  },
  // In Next.js, client vars must be destructured explicitly so the bundler can inline them.
  runtimeEnv: {
    DATABASE_URL: process.env.DATABASE_URL,
    DIRECT_URL: process.env.DIRECT_URL,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    NODE_ENV: process.env.NODE_ENV,
    PING_PROVIDER: process.env.PING_PROVIDER,
    PING_FALLBACK: process.env.PING_FALLBACK,
    SRD_PROVIDER: process.env.SRD_PROVIDER,
    SRD_FALLBACK: process.env.SRD_FALLBACK,
    OPEN5E_BASE_URL: process.env.OPEN5E_BASE_URL,
    DND5EAPI_BASE_URL: process.env.DND5EAPI_BASE_URL,
    AI_PROVIDER: process.env.AI_PROVIDER,
    AI_MODEL: process.env.AI_MODEL,
    AI_FALLBACK: process.env.AI_FALLBACK,
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    GROQ_API_KEY: process.env.GROQ_API_KEY,
    AI_MODEL_CLASSIFY: process.env.AI_MODEL_CLASSIFY,
    AI_MODEL_ANSWER: process.env.AI_MODEL_ANSWER,
    AI_MODEL_REASONING: process.env.AI_MODEL_REASONING,
    UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
    UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN,
    ASSISTANT_DAILY_TOKEN_BUDGET: process.env.ASSISTANT_DAILY_TOKEN_BUDGET,
    CRON_SECRET: process.env.CRON_SECRET,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  },
  // Treat empty strings as undefined so a blank var fails the "required" rule.
  emptyStringAsUndefined: true,
  // Allows builds/tooling to skip validation when env is intentionally absent.
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
});
