## 1. Nonce CSP + security headers (proxy)

- [x] 1.1 In `proxy.ts`, generate a per-request nonce (`crypto.randomUUID()` → base64); build the CSP (`script-src 'self' 'nonce-…' 'strict-dynamic'`, `'unsafe-eval'` only in dev; `style-src 'self' 'unsafe-inline'`; `img-src 'self' data: blob: https:`; `connect-src 'self'` + Supabase origin; `frame-src`/Turnstile; `frame-ancestors 'none'`; `default-src 'self'`; `object-src 'none'`; `base-uri 'self'`; `form-action 'self'`)
- [x] 1.2 Forward the nonce on a request header (`x-nonce`) and set the CSP on the response; integrate with the existing Supabase cookie response flow so headers persist
- [x] 1.3 Add `Referrer-Policy: strict-origin-when-cross-origin`, `X-Content-Type-Options: nosniff`, and `Strict-Transport-Security` (HSTS) to responses
- [x] 1.4 Pass the nonce to `next-themes` `ThemeProvider` (read `x-nonce` via `headers()` in the root layout) so its inline theme script carries the nonce

## 2. Cookies (confirm)

- [x] 2.1 Confirm session cookies are `httpOnly` + `Secure` + `SameSite` (proxy + server client) and add a test asserting it

## 3. CSRF / Origin checks

- [x] 3.1 Add `lib/security/origin.ts` `isSameOrigin(req)` comparing `Origin` to the app host (`x-forwarded-host`/`host`)
- [x] 3.2 Enforce the Origin check on state-changing browser routes (`/api/assistant` POST; the tRPC POST/mutation endpoint), rejecting cross-origin; leave the secret-gated cron route as-is; rely on Server Actions' built-in CSRF

## 4. Centralized request-size + rate limits

- [x] 4.1 Add `lib/security/limits.ts` (request-size cap + the per-user/per-IP rate limit) as one boundary entry point; migrate `/api/assistant` off its ad hoc checks (keep the assistant token-budget in `lib/ai`)

## 5. Redacted logger + audit

- [x] 5.1 Add `lib/observability/logger.ts` (redacted structured logger — allow-listed fields only) and an `audit()` sink; migrate `lib/ai/audit.ts` and the account-deletion log to it, preserving their redacted shapes

## 6. Client-secret guard + CI

- [x] 6.1 Add a boundary test asserting NO server env key (DATABASE_URL, DIRECT_URL, SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC/OPENAI/GROQ keys, CRON_SECRET, UPSTASH tokens) appears in client-reachable code; only `NEXT_PUBLIC_*` allowed
- [x] 6.2 Add `.github/workflows/ci.yml`: `npm ci`, `npx tsc --noEmit`, `npx vitest run` (DB-integration self-skips without `DIRECT_URL`), `npm audit --audit-level=high`, and a secret scan (gitleaks)

## 7. Tests

- [x] 7.1 CSP/headers: a page response carries a `Content-Security-Policy` with a fresh `nonce-…` and NO `unsafe-inline` in `script-src`, plus Referrer-Policy, nosniff, HSTS, and `frame-ancestors 'none'`
- [x] 7.2 Origin: a cross-origin POST to a state-changing route is rejected; a same-origin one passes the check
- [x] 7.3 Auth: protected routes still reject anonymous access (proxy), and hardened-cookie attributes are asserted
- [x] 7.4 Logger: redacted logger/audit emit allow-listed fields only (no secret/token/PII)
- [x] 7.5 Client-secret boundary test passes (and would fail on a planted server-secret reference in client code)

## 8. Verification

- [x] 8.1 Run `npx tsc --noEmit` and fix any type errors (no `any`)
- [x] 8.2 Run the Vitest suite (node + jsdom) and confirm all tests pass
- [x] 8.3 Confirm `next build` succeeds and manually verify the auth pages (Turnstile), avatar images, and theme toggle work under the enforced CSP (no console CSP violations)
