## MODIFIED Requirements

### Requirement: Auth proxy refreshes the session and protects routes
The system SHALL run a Next.js Proxy (the Next.js 16 convention formerly named Middleware,
defined in `proxy.ts` exporting `proxy`) that refreshes the Supabase session on each request
and protects every application route. Unauthenticated requests to a protected route MUST be
redirected to `/sign-in`. The public routes exempt from the redirect are the `(auth)` pages
(`/sign-in`, `/sign-up`, `/forgot-password`, `/reset-password`) and the `/auth/*` route
handlers (callback/confirm). Already-authenticated users requesting an `(auth)` page MUST be
redirected away into the app, so signed-in users do not see the auth pages.

#### Scenario: Anonymous request to a protected route is redirected to sign-in
- **WHEN** an unauthenticated user requests a protected route
- **THEN** the proxy redirects them to `/sign-in`

#### Scenario: Public auth routes are reachable without a session
- **WHEN** an unauthenticated user requests an `(auth)` page or an `/auth/*` handler
- **THEN** the request is allowed through

#### Scenario: Signed-in users are kept out of the auth pages
- **WHEN** an authenticated user requests an `(auth)` page (e.g. `/sign-in`)
- **THEN** the proxy redirects them into the app

#### Scenario: Session is refreshed on each request
- **WHEN** an authenticated user makes a request with a refreshable session
- **THEN** the proxy refreshes the session cookies before the route runs

### Requirement: Email authentication with login, logout, and callback
The system SHALL support email authentication with **password as the primary method** and
**magic link as a secondary path**. It SHALL provide sign-in, sign-up, logout, a PKCE
`auth/callback` handler, and an `auth/confirm` handler (`verifyOtp` with `token_hash` +
`type`) for email confirmation/recovery. All establish or clear the session via the server
client so cookies are written correctly.

#### Scenario: Password sign-in establishes a session
- **WHEN** a user signs in with a correct email + password
- **THEN** the session is established via the server client and the user reaches the app

#### Scenario: Magic link remains available as a secondary path
- **WHEN** a user chooses "send a magic link instead"
- **THEN** a magic link is sent and, on confirmation, the session is established

#### Scenario: Logout clears the session
- **WHEN** an authenticated user logs out
- **THEN** the session cookies are cleared and protected routes redirect to `/sign-in` again
