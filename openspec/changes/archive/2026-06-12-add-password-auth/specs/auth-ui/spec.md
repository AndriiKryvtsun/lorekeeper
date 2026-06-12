## ADDED Requirements

### Requirement: Authentication pages in an (auth) route group
The system SHALL provide accessible pages in an `(auth)` route group built from the design
system: sign-up (email + password + confirm-password), sign-in (email + password, with
"send a magic link instead" and "forgot password" links), forgot-password (request a
reset), and reset-password (set a new password). Password is the primary method; magic
link is a secondary path.

#### Scenario: Auth pages render with password as the primary method
- **WHEN** an unauthenticated user opens `/sign-in` or `/sign-up`
- **THEN** an email + password form renders, with magic-link offered as a secondary option on sign-in

### Requirement: Credential submissions are Server Actions via the server client
All credential operations SHALL be Server Actions that call the SERVER Supabase client so
session cookies are set correctly: `signUp` (with `emailRedirectTo` the confirm route),
`signInWithPassword`, `resetPasswordForEmail` (with `redirectTo` the reset page),
`updateUser({ password })` for reset/set-password, and `signOut`.

#### Scenario: Successful sign-in sets the session cookie
- **WHEN** a sign-in Server Action succeeds
- **THEN** it uses the server client so the session cookie is written, and the user is redirected to the app

#### Scenario: Credentials never reach a client-only auth call
- **WHEN** a credential operation runs
- **THEN** it executes server-side via the server client (not a browser-only call that would not set cookies)

### Requirement: Email confirmation and recovery handlers
The system SHALL provide `app/auth/confirm/route.ts` that calls `verifyOtp` with
`token_hash` + `type` for email confirmation/recovery, and retain `app/auth/callback/route.ts`
for PKCE code exchange. Both establish the session via the server client and redirect onward.

#### Scenario: Email confirmation establishes a session
- **WHEN** a user follows an email confirmation link carrying `token_hash` and `type`
- **THEN** the confirm handler verifies the OTP, establishes the session, and redirects onward

### Requirement: Set-password path for magic-link users
The system SHALL provide a "set password" form in account settings so users who joined via
magic link (and have no password) can set one via `updateUser({ password })`.

#### Scenario: Magic-link user sets a password
- **WHEN** an authenticated magic-link user submits the set-password form with a valid password
- **THEN** their password is set and other sessions are signed out (global scope)

### Requirement: Enumeration resistance
The system SHALL NOT reveal whether an email is registered. Sign-up with an existing email
and a password reset request SHALL both return an identical generic "check your email"
result. Sign-in failures SHALL return a generic error ("invalid email or password") that
does not distinguish unknown-email from wrong-password.

#### Scenario: Sign-up with an existing email looks identical to a new sign-up
- **WHEN** a user submits sign-up for an email that already exists
- **THEN** the response is the same generic "check your email" result shown for a brand-new sign-up

#### Scenario: Password reset response is identical regardless of existence
- **WHEN** a reset is requested for any email (registered or not)
- **THEN** the response is the same generic "check your email" result

#### Scenario: Sign-in error is generic
- **WHEN** sign-in fails for any reason (unknown email or wrong password)
- **THEN** the error message is a generic "invalid email or password"

### Requirement: Reset requires a valid recovery session
The reset-password page SHALL require a valid recovery session and MUST refuse to update a
password without one. Reset tokens SHALL be single-use.

#### Scenario: Reset without a recovery session is refused
- **WHEN** the reset-password update is attempted without a valid recovery session
- **THEN** the update is refused and no password change occurs

#### Scenario: A reset token cannot be reused
- **WHEN** a recovery token is used a second time
- **THEN** it is rejected (single-use)

### Requirement: CAPTCHA on sign-up, sign-in, and reset (fail closed)
The system SHALL integrate Cloudflare Turnstile on sign-up, sign-in, and reset, passing the
captcha token to Supabase. If no token is present or verification fails, the action MUST
fail closed (be blocked) rather than proceeding.

#### Scenario: Missing captcha token blocks the action
- **WHEN** a captcha-protected Server Action runs without a captcha token
- **THEN** the action is blocked and no auth call is made

#### Scenario: Valid token is forwarded to Supabase
- **WHEN** a captcha-protected action runs with a token
- **THEN** the token is passed to Supabase as `captchaToken`

### Requirement: Shared email and password validation
The system SHALL define shared Zod schemas in `lib/validation` for email and password:
email is normalized (trimmed + lowercased); password meets a minimum length aligned with
the Supabase policy; confirm-password must match. These schemas SHALL validate client-side
for UX and server-side authoritatively.

#### Scenario: Weak or mismatched passwords are rejected
- **WHEN** a password below the minimum length, or a confirm that does not match, is submitted
- **THEN** validation rejects it both client-side and server-side

#### Scenario: Email is normalized
- **WHEN** an email with surrounding whitespace or mixed case is submitted
- **THEN** it is trimmed and lowercased before use

### Requirement: Accessible auth forms
Auth forms SHALL use correct `autocomplete` attributes (e.g. `email`, `current-password`,
`new-password`), labelled inputs with associated error text, `aria-live` error regions,
managed focus, and an accessible show/hide-password toggle.

#### Scenario: Errors are announced and associated with inputs
- **WHEN** a submission produces field or form errors
- **THEN** errors are associated with their inputs and announced via an `aria-live` region

#### Scenario: Password visibility can be toggled accessibly
- **WHEN** a user activates the show/hide-password control
- **THEN** the input's visibility toggles and the control exposes its state to assistive tech

### Requirement: No sensitive logging
The system SHALL NOT log credentials, tokens, or whether an email exists.

#### Scenario: Secrets are absent from logs
- **WHEN** any auth action runs (success or failure)
- **THEN** passwords, tokens, and email-existence signals do not appear in logs

### Requirement: Post-auth navigation
After a successful sign-in the system SHALL redirect to the app. After a sign-up that
requires email confirmation it SHALL show a "check your email" state rather than a logged-in
view.

#### Scenario: Sign-in redirects into the app
- **WHEN** sign-in succeeds
- **THEN** the user is redirected to the application

#### Scenario: Sign-up needing confirmation shows check-your-email
- **WHEN** sign-up succeeds but email confirmation is required
- **THEN** a "check your email" state is shown and the user is not treated as signed in
