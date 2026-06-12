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
  },
  client: {
    NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  },
  // In Next.js, client vars must be destructured explicitly so the bundler can inline them.
  runtimeEnv: {
    DATABASE_URL: process.env.DATABASE_URL,
    DIRECT_URL: process.env.DIRECT_URL,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    NODE_ENV: process.env.NODE_ENV,
    PING_PROVIDER: process.env.PING_PROVIDER,
    PING_FALLBACK: process.env.PING_FALLBACK,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  },
  // Treat empty strings as undefined so a blank var fails the "required" rule.
  emptyStringAsUndefined: true,
  // Allows builds/tooling to skip validation when env is intentionally absent.
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
});
