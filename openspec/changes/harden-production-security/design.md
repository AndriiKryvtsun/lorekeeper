## Context

The proxy (`proxy.ts`, Next 16 middleware) already refreshes the Supabase session, protects
routes, and sets hardened cookies (`httpOnly`/`Secure`/`SameSite`). `next.config.ts` has only a
rewrite. Route handlers: `/api/assistant` (POST; does its own size + rate + budget checks),
`/api/trpc/[trpc]` (GET/POST), `/api/cron/summarize-sessions` (secret-gated), `/auth/*` (GET).
Audit logging is scattered (`lib/ai/audit.ts`, an inline account-deletion log). No CI exists.
The UI uses `next-themes` (which injects an inline theme script) and Cloudflare Turnstile.

## Goals / Non-Goals

**Goals:** nonce CSP + security headers; Origin checks on browser-facing state-changing routes;
centralized size/rate limits; redacted logger + audit; CI dependency/secret scan + a
client-secret-leak guard.

**Non-Goals:** no change to auth/session-refresh/route-protection behavior, tRPC type inference,
or `/api/assistant` streaming; no new runtime dependency.

## Decisions

### 1. Per-request nonce CSP emitted by the proxy
The proxy generates a nonce (`crypto.randomUUID()` → base64) per request, builds the CSP, sets it
on a forwarded REQUEST header (`x-nonce` + the CSP) so Next applies the nonce to its own scripts,
and sets the CSP + security headers on the RESPONSE. This integrates with the existing Supabase
cookie flow (the nonce/headers are applied to the same response object the cookie `setAll`
rebuilds). Script policy: `script-src 'self' 'nonce-<n>' 'strict-dynamic'` (plus `'unsafe-eval'`
ONLY in development for HMR) — no `unsafe-inline`. Rationale: `strict-dynamic` lets the nonced
runtime load chunks and the Turnstile loader without listing hosts.

### 2. CSP source allow-list for our integrations
- `default-src 'self'`; `object-src 'none'`; `base-uri 'self'`; `form-action 'self'`;
  `frame-ancestors 'none'`.
- `style-src 'self' 'unsafe-inline'` — styles may stay inline (the requirement forbids inline
  *scripts*, not styles; nonce-ing Tailwind/Next styles is impractical).
- `img-src 'self' data: blob: https:` — `next/image` + Supabase Storage avatars.
- `connect-src 'self'` + the Supabase URL origin (browser → Supabase auth/DB/storage).
- `frame-src` + `script-src` allowance for Cloudflare Turnstile (loaded via `strict-dynamic`;
  iframe host in `frame-src`).
Rationale: a strict default with explicit, minimal allowances for the few external integrations.

### 3. `next-themes` inline script gets the nonce explicitly
`next-themes` injects an inline script to set the theme pre-paint; under a nonce CSP it must
carry the nonce. The root layout reads the `x-nonce` request header (`headers()`) and passes it
to `ThemeProvider`'s `nonce` prop. Rationale: third-party inline scripts aren't auto-nonced by
Next, so this is required to avoid a blocked theme script (FOUC + console error).

### 4. Origin checks on browser-facing state-changing routes only
Add `lib/security/origin.ts` `isSameOrigin(req)` comparing the `Origin` header to the app host
(`x-forwarded-host`/`host`). Apply to `/api/assistant` (POST) and the tRPC route (POST/mutations).
The cron route stays SECRET-gated (server-to-server, no browser Origin) — an Origin check there
would be wrong. Server Actions already have built-in CSRF (Next Origin check), so they need no
extra guard. Rationale: defense-in-depth exactly where browser-driven mutations enter.

### 5. Centralized request-size + rate limits
Add `lib/security/limits.ts` exposing one entry point (size cap + the existing per-user/per-IP
rate limit) used at the request boundary. `/api/assistant` migrates its ad hoc content-length +
rate-limit checks to it; the assistant's daily TOKEN budget stays in `lib/ai` (domain-specific).
Rationale: one place to reason about limits.

### 6. Redacted logger + consolidated audit
Add `lib/observability/logger.ts` (structured, allow-listed fields only — no secret/token/PII
parameter) and an `audit()` sink. `lib/ai/audit.ts` and the account-deletion log migrate to it,
preserving their existing redacted shapes. Rationale: one redaction-by-construction sink.

### 7. Client-secret guard + CI
A boundary test scans client-reachable code and fails if any SERVER env key (DATABASE_URL,
DIRECT_URL, SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC/OPENAI/GROQ keys, CRON_SECRET, UPSTASH tokens)
appears — only `NEXT_PUBLIC_*` is allowed. Add `.github/workflows/ci.yml`: `npm ci`, `tsc
--noEmit`, `vitest run` (DB-integration tests self-skip without `DIRECT_URL`), `npm audit
--audit-level=high`, and a secret scan (gitleaks). Rationale: makes the guarantees enforced, not
aspirational.

## Risks / Trade-offs

- **CSP breaks Turnstile / Supabase / theme script** → enumerated allow-list + `strict-dynamic`
  + explicit `next-themes` nonce; verify the auth pages (Turnstile) and avatar images render.
- **Nonce in middleware runtime** → use Web Crypto (`crypto.randomUUID`), available in the
  proxy runtime; base64 for the CSP token.
- **Over-strict Origin check breaking same-site proxies** → compare against forwarded host and
  allow missing-Origin only for non-browser secret-gated routes (cron), not for `/api/assistant`.
- **HSTS in dev** → harmless over http; only enforced by browsers over https.
- **CI integration tests need a DB** → they self-skip when `DIRECT_URL` is unset, so CI runs the
  unit suite without provisioning Postgres.

## Open Questions

- Exact Turnstile/Supabase hostnames for `connect-src`/`frame-src` are finalized during apply by
  testing the auth + avatar flows under the policy (start in report-only if needed, then enforce).
