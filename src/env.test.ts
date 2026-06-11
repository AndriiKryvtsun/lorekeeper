import { createEnv } from "@t3-oss/env-nextjs";
import { describe, expect, it } from "vitest";
import { z } from "zod";

// Exercises env validation directly (independent of the app's module-level env, which
// runs with SKIP_ENV_VALIDATION in tests). Mirrors the shape of src/env.ts.
function buildEnv(runtimeEnv: Record<string, string | undefined>) {
  return createEnv({
    server: {
      DATABASE_URL: z.string().url(),
      SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
    },
    client: {
      NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
    },
    runtimeEnv,
    emptyStringAsUndefined: true,
    // Force validation regardless of the test-wide SKIP_ENV_VALIDATION flag.
    skipValidation: false,
    onValidationError: (issues) => {
      throw new Error(`Invalid env: ${JSON.stringify(issues)}`);
    },
  });
}

describe("env validation fails fast", () => {
  it("accepts a fully valid environment", () => {
    expect(() =>
      buildEnv({
        DATABASE_URL: "postgresql://user:pass@host:5432/db",
        SUPABASE_SERVICE_ROLE_KEY: "secret",
        NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      }),
    ).not.toThrow();
  });

  it("throws when a required variable is missing", () => {
    expect(() =>
      buildEnv({
        DATABASE_URL: "postgresql://user:pass@host:5432/db",
        // SUPABASE_SERVICE_ROLE_KEY missing
        NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      }),
    ).toThrow();
  });

  it("throws when a variable is invalid (non-URL where URL required)", () => {
    expect(() =>
      buildEnv({
        DATABASE_URL: "not-a-url",
        SUPABASE_SERVICE_ROLE_KEY: "secret",
        NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      }),
    ).toThrow();
  });
});
