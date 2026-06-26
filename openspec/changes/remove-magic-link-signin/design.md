## Context

Magic-link sign-in was a secondary path alongside password auth. It comprises a
client action on the sign-in form, the `signInWithMagicLink` Server Action (Supabase
`signInWithOtp` with `emailRedirectTo` the PKCE callback), and supporting spec
requirements. This change removes the send-magic-link path while leaving every other
auth flow intact.

## Goals / Non-Goals

**Goals:**
- Sign-in offers email + password and forgot-password only.
- Remove the `signInWithMagicLink` action and its UI trigger.
- Keep specs and code in sync (specs updated first).

**Non-Goals:**
- No change to password sign-in/sign-up, email confirmation/recovery, password reset,
  CAPTCHA, enumeration resistance, or session/proxy handling.
- Not removing the PKCE `auth/callback` route or the account set-password form.

## Decisions

- **Keep `app/auth/callback/route.ts`.** It is a generic PKCE code-exchange handler, not
  magic-link-specific; removing it would widen scope and risk the email flows. It simply
  has no magic-link caller anymore.
- **Keep the account set-password form.** It lets any password-less user set a password;
  it is independent of whether new magic-link users can be created.
- **Remove the `signInWithOtp` mock stub** from `lib/auth/actions.test.ts` since its only
  caller (`signInWithMagicLink`) is gone — no behavioral test depended on it.

## Risks / Trade-offs

- [Existing magic-link-only users can no longer request a new link] → They can still use
  "forgot password" to set a password and sign in; the set-password form remains. Mitigated.
- [Dead PKCE callback route] → Retained intentionally (generic handler); no action needed.
