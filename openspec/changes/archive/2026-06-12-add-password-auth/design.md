## Context

Change 2 set up Supabase Auth: browser/server `@supabase/ssr` clients, secure session
cookies, a session-refreshing proxy (`proxy.ts`, redirecting to `/login`), a magic-link
`/login` page, `auth/callback` (PKCE) and `auth/logout` handlers, and a server-only
`getCurrentUser()`. Change 3 provides the design system (Button, Input, Label, Card,
accessible primitives). `~/env` is the only env reader; secrets are server-only; tests run
with every change. This change adds the full email+password auth UI/flows, hardens them,
and rewires routing — keeping magic link as a secondary path. No MFA.

## Goals / Non-Goals

**Goals:**
- `(auth)` pages (sign-in, sign-up, forgot-password, reset-password) + an account-settings
  set-password form, accessible and on the design system.
- Credential operations as Server Actions via the server client (cookies set correctly):
  signUp, signInWithPassword, resetPasswordForEmail, updateUser(password), signOut.
- `auth/confirm` (verifyOtp) handler; keep PKCE `auth/callback`.
- Security: enumeration resistance, recovery-session-gated reset (single-use), Turnstile
  CAPTCHA (fail closed), shared Zod email/password schemas (normalize email, min length,
  confirm match), accessibility, no sensitive logging, global sign-out on password change.
- Rewire the proxy: redirect unauthenticated → `/sign-in`; keep signed-in users out of
  `(auth)` pages.

**Non-Goals:**
- MFA / TOTP (separate follow-on).
- Social/OAuth providers, account deletion, email-change flow.
- A full account-settings surface beyond the set-password form.

## Decisions

- **`(auth)` route group with a redirect guard.** `app/(auth)/layout.tsx` redirects
  already-authenticated users into the app (`/campaigns`). Pages: `sign-in/`, `sign-up/`,
  `forgot-password/`, `reset-password/`. The old `/login` page is removed; `proxy.ts` and
  `app/(app)/layout.tsx` and `auth/logout` now target `/sign-in`.
- **Server Actions in `lib/auth/actions.ts` (`"use server"`).** Each action: parse
  `FormData` → Zod validate (authoritative) → require a captcha token (fail closed) → call
  the SERVER Supabase client. Returning typed results (`{ ok, error?, ... }`) consumed by
  client forms via React 19 `useActionState`. Using the server client is what writes the
  session cookie. Actions accept an injectable client factory (default real) so tests can
  pass a fake Supabase client.
- **Enumeration resistance is enforced in the action, not left to Supabase.** `signUp` and
  `resetPasswordForEmail` actions ALWAYS return the identical generic "check your email"
  result on anything other than validation/captcha failure — they never branch on whether
  the email exists. `signInWithPassword` maps ANY auth error to a single generic "invalid
  email or password". Supabase's own obfuscation is a backstop, not the guarantee.
- **Recovery-session-gated reset.** The recovery email links to `auth/confirm`
  (`verifyOtp`, `type=recovery`) which establishes a recovery session, then redirects to
  `/reset-password`. The reset action calls `updateUser({ password })` only when
  `getCurrentUser()` returns a user; otherwise it refuses. Recovery tokens are single-use
  (consumed by `verifyOtp`). On success it signs out other sessions (`signOut({ scope:
  "global" })`), as does the set-password and any password change.
- **CAPTCHA: Cloudflare Turnstile, fail closed.** A client `<Turnstile>` widget
  (`@marsidev/react-turnstile`) writes its token into a hidden `captchaToken` field on
  sign-up/sign-in/reset. The Server Action blocks immediately if the token is absent, and
  passes it to Supabase as `options.captchaToken`; Supabase performs verification (its
  secret lives in the Supabase dashboard). Site key from `NEXT_PUBLIC_TURNSTILE_SITE_KEY`.
- **Shared validation in `lib/validation/auth.ts`.** `emailSchema` trims + lowercases via
  transform; `passwordSchema` enforces `PASSWORD_MIN_LENGTH` (8, documented to match the
  Supabase dashboard policy); sign-up/reset schemas `.refine` confirm-password match. Forms
  use `zodResolver` for client UX; actions re-validate authoritatively.
- **Accessibility.** A shared `PasswordField` with an accessible show/hide toggle
  (`type` swap + `aria-pressed`), correct `autocomplete` (`email`, `current-password`,
  `new-password`), labelled inputs with `aria-describedby` error text, and an `aria-live`
  region for form-level errors; focus moves to the first error / the error summary on
  failure.
- **No sensitive logging.** Actions never `console.log` form values, tokens, or Supabase
  error specifics; only generic outcomes. (Aligns with the SDK telemetry redaction stance.)
- **Proxy rewire.** `PUBLIC_PATHS` becomes the `(auth)` pages + `/auth`; unauthenticated →
  `/sign-in`; if a user is present and the path is an `(auth)` page → redirect to
  `/campaigns`. `/api/*` still 401s for anonymous.

## Risks / Trade-offs

- **Password policy drift** → `PASSWORD_MIN_LENGTH` must match the Supabase dashboard
  policy; documented in the schema file and proposal. If they diverge, server-side Supabase
  rejects — still safe, just a worse message.
- **Enumeration leaks via timing/links** → mitigated by always returning the identical
  result shape and never branching on existence; we accept that timing side-channels are
  out of scope.
- **Testing CAPTCHA/widget** → per decision, actions are token-gated with a mockable client
  seam; the real widget renders client-side but is not unit-tested. Tests assert
  missing-token → blocked and token → forwarded.
- **Reset without recovery session** → enforced by the action's `getCurrentUser()` check,
  not just by page rendering, so a direct action call still refuses.
- **Removing `/login`** → update every referrer (`proxy.ts`, `(app)` layout, logout). A
  test covers the proxy redirect target.
- **`useActionState` + Server Actions in tests** → unit-test the action functions directly
  (inject a fake client) rather than driving them through the React hook.

## Migration Plan

1. Add Turnstile dep + `NEXT_PUBLIC_TURNSTILE_SITE_KEY` to `src/env.ts`.
2. Add `lib/validation/auth.ts` (email/password schemas + `PASSWORD_MIN_LENGTH`).
3. Add `lib/auth/actions.ts` Server Actions (server client, captcha-gated, enumeration-safe,
   recovery-gated reset, global sign-out on password change).
4. Add `app/auth/confirm/route.ts`; keep/align `auth/callback`; point `auth/logout` at
   `/sign-in`.
5. Build `(auth)` pages + layout, the Turnstile widget wrapper, `PasswordField`, and the
   account-settings set-password form (client forms via `useActionState`).
6. Rewire `proxy.ts` and `app/(app)/layout.tsx`; remove `/login`.
7. Tests (enumeration, generic sign-in, reset gating, captcha fail-closed, Zod, action
   cookie/server-client usage, proxy both-direction redirects); run `tsc`, suite, `next build`.
- **Rollback:** restore `/login` + the prior proxy redirect; remove `(auth)` pages,
  actions, confirm route, and the Turnstile dep/env.

## Open Questions

- Exact `PASSWORD_MIN_LENGTH` vs the Supabase project policy — assumed 8; adjust the
  constant if the dashboard policy differs.
- Post-sign-in destination — assumed `/campaigns`; could be a `redirectTo` param later.
