## Why

The app is feature-complete but not yet hardened for production: there are no security response
headers or Content-Security-Policy, state-changing route handlers don't verify request origin,
request-size/rate limits are enforced ad hoc per route, sensitive-action logging is scattered,
and CI runs no dependency/secret scan. We want defense-in-depth that closes common web risks
(XSS, clickjacking, CSRF, MIME sniffing, secret leakage) before launch.

## What Changes

- **Security headers + strict CSP** (via the proxy/middleware): a per-request **nonce-based
  Content-Security-Policy** with NO `unsafe-inline` scripts, plus `frame-ancestors 'none'`,
  `Referrer-Policy: strict-origin-when-cross-origin`, `X-Content-Type-Options: nosniff`, and
  `Strict-Transport-Security` (HSTS).
- **Cookies:** confirm (and test) session cookies remain `httpOnly` + `Secure` + `SameSite`.
- **CSRF/Origin:** rely on Server Actions' built-in CSRF protection; add **Origin checks** to
  state-changing route handlers (e.g. `/api/assistant`, the tRPC mutation endpoint).
- **Centralized limits:** one module for request-size and rate limits, applied at the boundary
  (replacing per-route ad hoc checks).
- **Observability:** a redacted structured logger and an audit log for sensitive actions,
  consolidating today's scattered `console.info` audit lines.
- **CI + secret safety:** a CI workflow running typecheck, tests, a dependency audit, and a
  secret scan; plus an assertion/test that NO secret reaches the client — only the Supabase anon
  key, which is public by design and backed by RLS.

## Capabilities

### New Capabilities
- `security-hardening`: production security posture — nonce CSP + security headers, confirmed
  hardened cookies, Origin checks on state-changing routes, centralized request-size/rate
  limits, a redacted logger + sensitive-action audit log, and CI dependency/secret scanning with
  a client-secret-leak guard.

### Modified Capabilities
<!-- None. This adds orthogonal behavior to the existing proxy and route handlers without
     changing the auth/route-protection requirements they already satisfy. -->

## Impact

- **Code:** the proxy (`proxy.ts`) gains nonce generation + CSP + security-header emission; a
  shared `lib/security/` for Origin checks and centralized size/rate limits; a redacted
  `lib/observability/` logger + audit sink (the assistant and account-deletion audits migrate to
  it); state-changing route handlers (`/api/assistant`, tRPC) add Origin verification.
- **CSP nonce:** the middleware sets the nonce on a request header so Next applies it to its own
  scripts; inline scripts without the nonce are blocked.
- **CI:** a new `.github/workflows` running `tsc`, Vitest, `npm audit`, and a secret scan; a
  boundary test asserting only `NEXT_PUBLIC_*` (anon key, public site URL) reach the client.
- **Unchanged:** auth/session refresh + route protection behavior, tRPC type inference, and the
  `/api/assistant` streaming contract; no new runtime dependency (CI may use an action for the
  secret scan).
