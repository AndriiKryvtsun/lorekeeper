## ADDED Requirements

### Requirement: Nonce-based Content-Security-Policy
The app SHALL set a per-request, nonce-based Content-Security-Policy via the proxy/middleware.
The script policy SHALL NOT use `unsafe-inline`; inline scripts SHALL execute only when carrying
the request's nonce. The middleware SHALL propagate the nonce so the framework applies it to its
own scripts.

#### Scenario: Responses carry a nonce CSP
- **WHEN** a page response is served
- **THEN** it includes a `Content-Security-Policy` header whose `script-src` contains a fresh per-request `nonce-…` and no `unsafe-inline`

#### Scenario: Inline scripts without the nonce are blocked
- **WHEN** markup contains an inline script lacking the request nonce
- **THEN** the CSP prevents it from executing

### Requirement: Security response headers
Every app response SHALL include `frame-ancestors 'none'` (in the CSP), `Referrer-Policy:
strict-origin-when-cross-origin`, `X-Content-Type-Options: nosniff`, and
`Strict-Transport-Security` (HSTS).

#### Scenario: Hardening headers are present
- **WHEN** a response is served
- **THEN** it includes Referrer-Policy, X-Content-Type-Options nosniff, HSTS, and frame-ancestors 'none'

### Requirement: Hardened session cookies
Session cookies SHALL be `httpOnly`, `Secure`, and `SameSite`.

#### Scenario: Session cookies are hardened
- **WHEN** the session cookies are set
- **THEN** they are marked httpOnly, Secure, and SameSite

### Requirement: CSRF and Origin protection
Server Actions SHALL rely on the framework's built-in CSRF protection. State-changing route
handlers SHALL additionally verify the request Origin against the app's own host and reject
cross-origin requests.

#### Scenario: Cross-origin state-changing request is rejected
- **WHEN** a state-changing route handler (e.g. the assistant or tRPC mutation endpoint) receives a request whose Origin is not the app's host
- **THEN** the request is rejected

#### Scenario: Same-origin request is allowed
- **WHEN** a state-changing route handler receives a same-origin request
- **THEN** the Origin check passes and the request proceeds to its existing auth/validation

### Requirement: Centralized request-size and rate limits
Request-size limits and rate limits SHALL be enforced through one shared module at the request
boundary, rather than ad hoc per route.

#### Scenario: Oversized or over-limit requests are blocked centrally
- **WHEN** a request exceeds the configured size or rate limit
- **THEN** it is rejected by the shared limiter before handler logic runs

### Requirement: Redacted logging and sensitive-action audit
The app SHALL provide a redacted structured logger and an audit log for sensitive actions. Logs
and audit records MUST NOT contain secrets, tokens, prompts, or PII.

#### Scenario: Sensitive actions are audited without secrets
- **WHEN** a sensitive action occurs (e.g. account deletion, an assistant call/commit)
- **THEN** a structured audit record is written with no secret/token/PII content

### Requirement: No secret reaches the client
No server secret SHALL be exposed to the client. Only `NEXT_PUBLIC_*` values reach the client —
namely the Supabase anon key (public by design, backed by RLS) and the public site URL. A
boundary test SHALL fail if a server secret is referenced in client-reachable code.

#### Scenario: Only public values are in the client bundle
- **WHEN** the client bundle / client-reachable code is scanned
- **THEN** no server secret appears; only `NEXT_PUBLIC_*` values are present

### Requirement: CI dependency and secret scanning
CI SHALL run typecheck, the test suite, a dependency audit, and a secret scan, and SHALL fail on
a detected committed secret.

#### Scenario: CI fails on a committed secret
- **WHEN** a secret is committed and CI runs
- **THEN** the secret scan fails the build

#### Scenario: CI runs typecheck, tests, and dependency audit
- **WHEN** CI runs on a change
- **THEN** it executes typecheck, the test suite, and a dependency audit
