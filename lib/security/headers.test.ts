import { describe, expect, it } from "vitest";

import {
  buildContentSecurityPolicy,
  generateNonce,
  SECURITY_HEADERS,
} from "@/lib/security/headers";

const prod = buildContentSecurityPolicy({
  nonce: "abc123",
  supabaseOrigin: "https://proj.supabase.co",
  dev: false,
});

describe("buildContentSecurityPolicy", () => {
  it("uses the nonce and strict-dynamic with NO unsafe-inline in script-src", () => {
    const scriptSrc = prod.split(";").map((d) => d.trim()).find((d) => d.startsWith("script-src"))!;
    expect(scriptSrc).toContain("'nonce-abc123'");
    expect(scriptSrc).toContain("'strict-dynamic'");
    expect(scriptSrc).not.toContain("unsafe-inline");
  });

  it("sets frame-ancestors 'none' and includes the Supabase origin in connect-src", () => {
    expect(prod).toContain("frame-ancestors 'none'");
    expect(prod).toContain("https://proj.supabase.co");
  });

  it("allows unsafe-eval ONLY in development", () => {
    expect(prod).not.toContain("'unsafe-eval'");
    const dev = buildContentSecurityPolicy({ nonce: "n", supabaseOrigin: null, dev: true });
    expect(dev).toContain("'unsafe-eval'");
  });
});

describe("generateNonce", () => {
  it("produces unique, non-empty values", () => {
    const a = generateNonce();
    const b = generateNonce();
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThan(0);
  });
});

describe("SECURITY_HEADERS", () => {
  it("includes the hardening headers", () => {
    expect(SECURITY_HEADERS["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
    expect(SECURITY_HEADERS["X-Content-Type-Options"]).toBe("nosniff");
    expect(SECURITY_HEADERS["Strict-Transport-Security"]).toContain("max-age=");
  });
});
