## MODIFIED Requirements

### Requirement: Authentication pages in an (auth) route group
The system SHALL provide accessible pages in an `(auth)` route group built from the design
system: sign-up (email + password + confirm-password), sign-in (email + password, with a
"forgot password" link), forgot-password (request a reset), and reset-password (set a new
password). Password is the authentication method; no magic-link option is offered.

#### Scenario: Auth pages render with password as the method
- **WHEN** an unauthenticated user opens `/sign-in` or `/sign-up`
- **THEN** an email + password form renders, with a forgot-password link on sign-in and no magic-link option
