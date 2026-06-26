## Why

Magic-link sign-in is a secondary auth path we no longer want to offer. Removing it
simplifies the sign-in surface to a single, well-understood method (email + password,
with password reset), and reduces the auth attack/again surface. Password remains the
primary and now the only sign-in method.

## What Changes

- Remove the **"Send a magic link instead"** action from the sign-in page and the
  `signInWithMagicLink` Server Action. Sign-in offers email + password and a
  "forgot password" link only.
- Update the `auth-ui` and `user-auth` specs so magic link is no longer a supported path.
- **Keep** the PKCE `app/auth/callback/route.ts` handler and the email
  confirmation/recovery (`auth/confirm`) flow — they are not magic-link-specific.
- **Keep** the account "set / change password" form (lets any password-less user set a
  password); we simply stop minting new magic-link users.

Non-goals: no change to password sign-in/sign-up, email confirmation/recovery, password
reset, CAPTCHA, enumeration resistance, or session handling.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `auth-ui`: sign-in no longer offers a "send a magic link instead" option; password is
  the only method (with a forgot-password link). The magic-link send path is removed.
- `user-auth`: email authentication supports password only; magic link is no longer a
  secondary path. The PKCE callback and `auth/confirm` handlers are retained.

## Impact

- **Affected specs:** `auth-ui`, `user-auth` (both MODIFIED).
- **Affected code:** `components/auth/sign-in-form.tsx` (remove the magic-link button +
  its action state), `lib/auth/actions.ts` (remove `signInWithMagicLink`), and the
  `signInWithOtp` mock stub in `lib/auth/actions.test.ts`.
- **Unaffected:** password sign-in/sign-up, `auth/confirm`, `auth/callback` (retained),
  password reset, set-password in account settings, CAPTCHA, session/proxy handling.
