# user-auth

## Purpose

Defines authentication for the application: Supabase browser and server clients,
secure session cookies, a session-refreshing proxy (Next.js 16's Proxy convention,
formerly Middleware) that protects routes, an email authentication flow with password
as the primary method and magic link as a secondary path (login/logout/callback/confirm),
and a server-only helper for resolving the current user.

## Requirements

### Requirement: Supabase browser and server clients
The system SHALL provide a browser Supabase client and a server Supabase client built
with `@supabase/ssr`. The server client MUST read and write the session through request
cookies. The browser client MUST use only the public anon key. The service-role key
MUST be used solely on the server and MUST never be sent to or referenced by client code.

#### Scenario: Browser client uses the anon key only
- **WHEN** the browser Supabase client is constructed
- **THEN** it is configured with `NEXT_PUBLIC_SUPABASE_ANON_KEY` and has no access to the service-role key

#### Scenario: Service-role key stays server-only
- **WHEN** client-side bundles are built
- **THEN** `SUPABASE_SERVICE_ROLE_KEY` does not appear in any client bundle or response

### Requirement: Secure session cookies
The system SHALL store the auth session in cookies set `httpOnly`, `Secure`, and
`SameSite=Lax`.

#### Scenario: Session cookie attributes
- **WHEN** the server sets or refreshes a session cookie
- **THEN** the cookie is marked `httpOnly`, `Secure`, and `SameSite=Lax`

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

### Requirement: Server-only getCurrentUser helper
The system SHALL provide a server-only `getCurrentUser()` helper that returns the
authenticated user derived from the session, or null/none when there is no session. It
MUST NOT be importable into client components.

#### Scenario: Returns the authenticated user
- **WHEN** `getCurrentUser()` is called within a request that has a valid session
- **THEN** it returns the user including the auth user id

#### Scenario: Returns no user when unauthenticated
- **WHEN** `getCurrentUser()` is called without a session
- **THEN** it returns null/none rather than throwing
