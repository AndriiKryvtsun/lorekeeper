## Why

Authentication today is magic-link only with a single minimal `/login` page. Most users
expect email + password sign-in, and we need the full account lifecycle — sign-up, sign-in,
password reset, and a way for magic-link/invited users to set a password. This change adds
the complete, accessible, security-hardened email+password auth UI and flows on top of the
existing Supabase Auth setup, keeping magic link as an optional secondary path.

## What Changes

- Add an `(auth)` route group of accessible pages built from shadcn/ui primitives:
  **sign-up** (email + password + confirm), **sign-in** (email + password, with "send a
  magic link instead" and "forgot password" links), **forgot-password** (request reset),
  **reset-password** (set a new password), plus a **set-password** form in **account
  settings** for users who joined via magic link. Password is the primary method; magic
  link is secondary.
- Add server route handlers: `app/auth/confirm/route.ts` (`verifyOtp` with `token_hash` +
  `type` for email confirmation) and keep `app/auth/callback/route.ts` (PKCE code exchange).
- All credential submissions are **Server Actions** calling the SERVER Supabase client so
  cookies are set correctly: `signUp` (emailRedirectTo the confirm route),
  `signInWithPassword`, `resetPasswordForEmail` (redirectTo the reset page),
  `updateUser({ password })` for reset/set-password, and `signOut`. On password reset or
  change, other sessions are signed out (global scope).
- **Security (enforced in code + tests):**
  - **Enumeration resistance**: sign-up with an existing email and password-reset both
    return an identical generic "check your email" result; sign-in errors are generic
    ("invalid email or password").
  - **Reset gating**: the reset-password page requires a valid recovery session and refuses
    to update otherwise; reset tokens are single-use.
  - **CAPTCHA (Cloudflare Turnstile)** on sign-up, sign-in, and reset; the token is passed
    to Supabase and the action **fails closed** when no/invalid token is present.
  - **Shared Zod schemas** in `lib/validation` for email + password (min length aligned with
    the Supabase policy; confirm-password match); validated client-side for UX and
    server-side authoritatively; email normalized (trim + lowercase).
  - **Accessibility**: correct `autocomplete` attributes, labelled inputs with associated
    error text, `aria-live` error regions, focus management, accessible show/hide-password
    toggle.
  - **No logging** of credentials, tokens, or whether an email exists.
- **Routing/redirects**: after sign-in, redirect to the app; after sign-up needing
  confirmation, show a "check your email" state; the proxy (Change 2) redirects
  unauthenticated users to `/sign-in` and keeps signed-in users out of the auth pages.
- **Out of scope**: MFA (a separate follow-on).

## Capabilities

### New Capabilities
- `auth-ui`: The email+password authentication UI and flows — the `(auth)` pages and the
  account-settings set-password form, the credential Server Actions (via the server
  client), the email-confirm route handler, the shared email/password Zod schemas, CAPTCHA
  integration (fail-closed), enumeration resistance, recovery-session-gated reset, global
  sign-out on password change, accessibility requirements, and post-auth redirect behavior.

### Modified Capabilities
- `user-auth`: The proxy now redirects unauthenticated users to `/sign-in` (the `(auth)`
  pages and `/auth/*` handlers are the public routes) AND redirects already-signed-in users
  away from the auth pages. The email-authentication requirement is updated so password is
  the primary method (magic link secondary) and to include the `verifyOtp` confirm handler
  alongside the PKCE callback.

## Impact

- **Dependencies**: a Turnstile widget (`@marsidev/react-turnstile` or the script tag).
- **Config**: `~/env` (`src/env.ts`) gains `NEXT_PUBLIC_TURNSTILE_SITE_KEY` (public).
- **New code**: `app/(auth)/{sign-in,sign-up,forgot-password,reset-password}/page.tsx`,
  `app/(app)/account/page.tsx` (set-password), `app/auth/confirm/route.ts`, auth Server
  Actions (`app/(auth)/actions.ts` or `lib/auth/actions.ts`), client form components, a
  Turnstile widget wrapper, and `lib/validation/auth.ts` (email/password schemas).
- **Touched**: `proxy.ts` (redirect target `/sign-in`, public auth routes, keep signed-in
  users out of auth pages); `app/(app)/layout.tsx` (redirect to `/sign-in`); the existing
  `/login` page is replaced by `/sign-in` (redirect or removal); logout handler reused.
- **Tests**: enumeration resistance (sign-up + reset identical generic result); generic
  sign-in failure; reset blocked without a recovery session; CAPTCHA failure blocks the
  action; Zod rejects weak/mismatched passwords; the Server Action sets the session cookie;
  the proxy redirects both directions correctly.
- No data-model changes. No MFA.
