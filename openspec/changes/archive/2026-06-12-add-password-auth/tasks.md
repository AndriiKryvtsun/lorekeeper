## 1. Dependencies, env & validation

- [x] 1.1 Install a Turnstile widget dependency (`@marsidev/react-turnstile`)
- [x] 1.2 Add `NEXT_PUBLIC_TURNSTILE_SITE_KEY` (public) to `src/env.ts`
- [x] 1.3 Add `lib/validation/auth.ts`: `PASSWORD_MIN_LENGTH` (8, documented to match the Supabase policy), `emailSchema` (trim + lowercase), `passwordSchema`, and `signUpSchema`/`signInSchema`/`resetRequestSchema`/`resetPasswordSchema` (confirm-password match via `.refine`)

## 2. Server Actions (server client, hardened)

- [x] 2.1 Add `lib/auth/actions.ts` (`"use server"`) with an injectable server-client factory for tests
- [x] 2.2 `signUp`: validate, require captcha token (fail closed), `signUp({ email, password, options: { emailRedirectTo: confirm, captchaToken } })`; ALWAYS return the identical generic "check your email" result (no existence branching)
- [x] 2.3 `signInWithPassword`: validate, captcha-gated; map ANY error to a generic "invalid email or password"; on success rely on the server client to set the cookie
- [x] 2.4 `resetPasswordForEmail`: validate, captcha-gated; `redirectTo` the reset page; ALWAYS return the identical generic result
- [x] 2.5 `updatePassword` (reset + set-password): refuse unless `getCurrentUser()` returns a user (recovery/auth session); on success `signOut({ scope: "global" })`
- [x] 2.6 `signInWithMagicLink` (secondary) and reuse `signOut`; ensure no credentials/tokens/email-existence are logged anywhere

## 3. Route handlers & routing

- [x] 3.1 Add `app/auth/confirm/route.ts`: `verifyOtp` with `token_hash` + `type`, establish session via server client, redirect onward (reset → `/reset-password`)
- [x] 3.2 Keep/align `app/auth/callback/route.ts` (PKCE); point `app/auth/logout` at `/sign-in`
- [x] 3.3 Rewire `proxy.ts`: public = `(auth)` pages (`/sign-in`,`/sign-up`,`/forgot-password`,`/reset-password`) + `/auth/*`; unauthenticated → `/sign-in`; signed-in on an `(auth)` page → redirect to `/campaigns`
- [x] 3.4 Update `app/(app)/layout.tsx` redirect to `/sign-in`; remove the old `/login` page

## 4. UI: (auth) pages + account settings

- [x] 4.1 Add `app/(auth)/layout.tsx` redirecting authenticated users into the app; add a Turnstile widget wrapper and an accessible `PasswordField` (show/hide toggle, `aria-pressed`, correct `autocomplete`)
- [x] 4.2 `sign-up` page/form: email + password + confirm; captcha; success → "check your email" state
- [x] 4.3 `sign-in` page/form: email + password; generic error via `aria-live`; "send a magic link instead" and "forgot password" links; captcha; success → redirect to app
- [x] 4.4 `forgot-password` page/form: email; captcha; generic "check your email" result
- [x] 4.5 `reset-password` page/form: new password + confirm; works only with a recovery session; on success sign out other sessions
- [x] 4.6 `app/(app)/account/page.tsx`: set-password form for magic-link users (`updatePassword`)
- [x] 4.7 Wire all forms with `useActionState`; labelled inputs + associated error text, `aria-live` error region, focus management

## 5. Tests

- [x] 5.1 Enumeration resistance: `signUp` with an existing email and `resetPasswordForEmail` both return the identical generic result (fake client)
- [x] 5.2 Generic sign-in failure: any auth error → "invalid email or password"
- [x] 5.3 Reset blocked without a recovery session: `updatePassword` refuses when `getCurrentUser()` is null; on success calls `signOut({ scope: "global" })`
- [x] 5.4 CAPTCHA fail closed: actions with no token are blocked and make no Supabase call; with a token, it is forwarded as `captchaToken`
- [x] 5.5 Zod: weak/short passwords and mismatched confirm are rejected; email is normalized (trim + lowercase)
- [x] 5.6 Server Action sets the session cookie: sign-in uses the server client (assert `signInWithPassword` called with normalized email + token via the injected client)
- [x] 5.7 Proxy both directions: anonymous → `/sign-in`; authenticated on `/sign-in` → `/campaigns`; public auth routes allowed (mock `@supabase/ssr` getUser)
- [x] 5.8 No sensitive logging: actions do not emit credentials/tokens/email-existence (spy on console)

## 6. Verification

- [x] 6.1 Run `npx tsc --noEmit` and fix any type errors (no `any`)
- [x] 6.2 Run the Vitest suite (node + jsdom) and confirm all tests pass
- [x] 6.3 Confirm `next build` succeeds; `(auth)` routes registered; `/login` gone; redirects correct
