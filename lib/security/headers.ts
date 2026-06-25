// Security headers + nonce CSP builder. Isomorphic: no env/secret import — callers pass the
// Supabase origin and dev flag. Used by the proxy/middleware.

// Per-request nonce (Web Crypto is available in the middleware and Node runtimes).
export function generateNonce(): string {
  return btoa(crypto.randomUUID());
}

const TURNSTILE = "https://challenges.cloudflare.com";

type CspOptions = { nonce: string; supabaseOrigin: string | null; dev: boolean };

// Strict, nonce-based policy. NO `unsafe-inline` for scripts; `strict-dynamic` lets the nonced
// runtime load chunks and the Turnstile loader. Styles keep `unsafe-inline` (Tailwind/Next
// inject styles; the requirement forbids inline scripts, not styles).
export function buildContentSecurityPolicy({ nonce, supabaseOrigin, dev }: CspOptions): string {
  const connect = ["'self'", supabaseOrigin, TURNSTILE].filter(Boolean).join(" ");
  const script = dev
    ? `'self' 'nonce-${nonce}' 'strict-dynamic' 'unsafe-eval'`
    : `'self' 'nonce-${nonce}' 'strict-dynamic'`;
  return [
    `default-src 'self'`,
    `script-src ${script}`,
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' data: blob: https:`,
    `font-src 'self'`,
    `connect-src ${connect}`,
    `frame-src ${TURNSTILE}`,
    `frame-ancestors 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `object-src 'none'`,
  ].join("; ");
}

// Static hardening headers applied to every response.
export const SECURITY_HEADERS: Record<string, string> = {
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Content-Type-Options": "nosniff",
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
};
