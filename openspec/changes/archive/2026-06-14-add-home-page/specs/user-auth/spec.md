## MODIFIED Requirements

### Requirement: Auth proxy refreshes the session and protects routes
The system SHALL run a Next.js Proxy (the Next.js 16 convention formerly named Middleware,
defined in `proxy.ts` exporting `proxy`) that refreshes the Supabase session on each request
and protects every application route. Unauthenticated requests to a protected route MUST be
redirected to `/sign-in`. The public routes exempt from the redirect are the home page (`/`),
the `(auth)` pages (`/sign-in`, `/sign-up`, `/forgot-password`, `/reset-password`) and the
`/auth/*` route handlers (callback/confirm). Already-authenticated users requesting an
`(auth)` page MUST be redirected away into the app, so signed-in users do not see the auth
pages. (The home page itself decides server-side to redirect authenticated users to
`/campaigns`; the proxy does not gate `/`.)

#### Scenario: Anonymous request to a protected route is redirected to sign-in
- **WHEN** an unauthenticated user requests a protected route
- **THEN** the proxy redirects them to `/sign-in`

#### Scenario: Public auth routes are reachable without a session
- **WHEN** an unauthenticated user requests an `(auth)` page or an `/auth/*` handler
- **THEN** the request is allowed through

#### Scenario: The home page is public
- **WHEN** an unauthenticated user requests `/`
- **THEN** the proxy allows the request through (it is not redirected to `/sign-in`)

#### Scenario: Signed-in users are kept out of the auth pages
- **WHEN** an authenticated user requests an `(auth)` page (e.g. `/sign-in`)
- **THEN** the proxy redirects them into the app

#### Scenario: Session is refreshed on each request
- **WHEN** an authenticated user makes a request with a refreshable session
- **THEN** the proxy refreshes the session cookies before the route runs
