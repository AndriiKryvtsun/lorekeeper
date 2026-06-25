# account-settings

## Purpose

Defines the self-service account settings capability: a self-scoped profile API,
profile editing, safe avatar uploads, password management, session control, and
reauthenticated account deletion, all delivered through an accessible, consistent UI.

## Requirements

### Requirement: Self-scoped profile API
The system SHALL expose a `profileRouter` of `protectedProcedure`s — `getMyProfile` and
`updateMyProfile` — that operate ONLY on the current user's profile. The `userId` SHALL always
come from `ctx.user.id` and NEVER from procedure input; any `userId`-like field in input SHALL
be ignored. Anonymous calls SHALL be rejected. `updateMyProfile` SHALL validate input with a
shared Zod schema and SHALL re-validate server-side.

#### Scenario: Anonymous access is rejected
- **WHEN** an unauthenticated caller invokes a profile procedure
- **THEN** it is rejected (unauthorized) and no profile is read or written

#### Scenario: Operations are scoped to the session user
- **WHEN** `getMyProfile`/`updateMyProfile` runs
- **THEN** it reads/writes only the profile keyed by `ctx.user.id`, ignoring any userId supplied in input

#### Scenario: Update is re-validated server-side
- **WHEN** `updateMyProfile` receives input
- **THEN** it is validated against the shared Zod schema before any write, rejecting invalid input

### Requirement: Profile editing rendered as plain text
The profile section SHALL let the user edit display name and bio using react-hook-form with
`zodResolver` and the shared schema. Stored profile text SHALL be rendered as plain text and
NEVER as raw HTML.

#### Scenario: Profile text is not rendered as HTML
- **WHEN** a display name or bio containing HTML-like text is displayed
- **THEN** it is shown as plain text (no raw HTML execution)

### Requirement: Safe avatar upload
Avatar uploads SHALL go to a per-user path in the Supabase `avatars` bucket. MIME type and size
SHALL be validated on BOTH client and server. ONLY raster image types SHALL be allowed and SVG
SHALL be rejected (stored-XSS risk). EXIF metadata SHALL be stripped before storage. The system
SHALL NOT trust a client-supplied storage path; the path SHALL be derived from `ctx.user.id`,
and bucket RLS SHALL ensure a user can only write their own folder.

#### Scenario: Non-raster and oversized files are rejected
- **WHEN** a user selects an SVG, a non-image, or an over-limit file
- **THEN** the upload is rejected on the client and the server, and nothing is stored

#### Scenario: EXIF is stripped and the path is user-scoped
- **WHEN** a valid raster image is uploaded
- **THEN** its EXIF metadata is stripped and it is stored under the user's own folder (path derived from `ctx.user.id`, not client input)

### Requirement: Password change with sign-out
Changing the password SHALL require a valid session. After a successful password change, all
OTHER sessions SHALL be signed out. The set-password form for magic-link users SHALL be
available on this page.

#### Scenario: Password change signs out other sessions
- **WHEN** a password change succeeds
- **THEN** the user's other sessions are signed out

#### Scenario: Set-password is available for magic-link users
- **WHEN** a magic-link user (no password) visits the account page
- **THEN** a form to set a password is available

### Requirement: Sign out other devices
The page SHALL provide an action to sign out the user's other sessions/devices.

#### Scenario: Other devices are signed out
- **WHEN** the user activates "sign out of all other devices"
- **THEN** the user's other sessions are revoked

### Requirement: Reauthenticated, irreversible account deletion
Deleting the account SHALL require BOTH a typed email confirmation (matching the user's current
email) AND reauthentication. On confirmation the server SHALL delete the user's owned data
(campaigns, which cascade to their children) and then delete the auth user via the Supabase
admin API using the service-role key, which is SERVER-ONLY and never exposed to the client. A
redacted audit record SHALL be written. The UI SHALL clearly warn the action is irreversible.

#### Scenario: Deletion requires typed confirmation and reauthentication
- **WHEN** a user requests account deletion without the matching typed email or without reauthenticating
- **THEN** the deletion is refused and nothing is deleted

#### Scenario: Confirmed deletion removes owned data and the auth user
- **WHEN** a user confirms deletion with the matching email and reauthentication
- **THEN** their owned campaigns (and cascaded children) and profile are deleted, the auth user is deleted via the service-role admin API, and an audit record is written

#### Scenario: Service-role key stays server-only
- **WHEN** the deletion runs
- **THEN** the service-role admin client is used only on the server and the key is never sent to or logged on the client

### Requirement: Accessible, consistent account UI
The page SHALL be built from design-system primitives with labelled inputs and associated error
text, an accessible file input, an accessible confirm dialog for deletion, loading/empty/error
states, success/error toasts, and full keyboard and screen-reader support. Secrets and tokens
SHALL never be logged.

#### Scenario: Forms and dialogs are accessible
- **WHEN** the account sections render
- **THEN** inputs have associated labels/error text, the delete confirm dialog is keyboard- and screen-reader-operable, and state changes surface via toasts

#### Scenario: No secret logging
- **WHEN** any account action runs
- **THEN** no secret, token, or password is logged

### Requirement: Sign out of the current session on the profile page
The profile page SHALL provide a "Sign out" button that ends ONLY the current session
(local-scope `signOut`) via a Server Action and redirects to the sign-in/landing page.
This SHALL be distinct from the existing "sign out of all other devices" (global scope):
it SHALL NOT revoke the user's other sessions. The button SHALL be a design-system
primitive, keyboard-operable, with a visible `focus-visible` ring.

#### Scenario: Profile sign-out ends only the current session
- **WHEN** the user activates the profile page's "Sign out" button
- **THEN** the current session is signed out with local scope, the user is redirected to the sign-in/landing page, and other sessions remain active

#### Scenario: Distinct from global sign-out
- **WHEN** the profile page renders its session controls
- **THEN** "Sign out" (current session, local) is presented distinctly from "sign out of all other devices" (global)
