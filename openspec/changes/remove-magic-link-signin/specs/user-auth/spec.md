## MODIFIED Requirements

### Requirement: Email authentication with login, logout, and callback
The system SHALL support email authentication with **password as the method**. It SHALL
provide sign-in, sign-up, logout, a PKCE `auth/callback` handler, and an `auth/confirm`
handler (`verifyOtp` with `token_hash` + `type`) for email confirmation/recovery. All
establish or clear the session via the server client so cookies are written correctly.
Magic-link sign-in is not offered.

#### Scenario: Password sign-in establishes a session
- **WHEN** a user signs in with a correct email + password
- **THEN** the session is established via the server client and the user reaches the app

#### Scenario: Logout clears the session
- **WHEN** an authenticated user logs out
- **THEN** the session cookies are cleared and protected routes redirect to `/sign-in` again
