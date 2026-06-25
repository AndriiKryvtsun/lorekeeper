## ADDED Requirements

### Requirement: User menu in the app-shell header
The shell header SHALL include an accessible avatar dropdown (shadcn/Radix dropdown
menu) showing the signed-in user's avatar and display name sourced from their profile.
The menu SHALL contain a **Profile** link, a **theme toggle**, and a **Sign out** item.
The trigger and menu SHALL expose correct menu semantics (a button trigger that controls
a menu; menu items with menu roles) and SHALL be fully keyboard-operable (open/close,
arrow navigation, activation, and focus return to the trigger on close). It SHALL be
read-only with respect to data — rendering profile data without mutating it.

#### Scenario: Menu shows the user's identity
- **WHEN** an authenticated user views the app-shell header
- **THEN** an avatar dropdown displays their avatar and display name from their profile

#### Scenario: Menu exposes correct roles and items
- **WHEN** the user menu is opened
- **THEN** it exposes menu semantics with Profile, a theme toggle, and Sign out items

#### Scenario: Menu is keyboard-operable
- **WHEN** a keyboard user operates the menu
- **THEN** it can be opened, navigated with the arrow keys, activated, and closed, with focus returning to the trigger on close

### Requirement: Sign out of the current session
The user menu's **Sign out** item and the profile page's sign-out button SHALL end ONLY
the current session (local-scope `signOut`) via a Server Action, then redirect to the
sign-in/landing page. This SHALL be distinct from the existing global "sign out of all
other devices"; it SHALL NOT revoke the user's other sessions.

#### Scenario: Sign out ends the current session and redirects
- **WHEN** the user activates Sign out from the menu or the profile page
- **THEN** a Server Action signs out the current session with local scope and the user is redirected to the sign-in/landing page

#### Scenario: Other sessions are not affected
- **WHEN** the current-session sign out runs
- **THEN** the user's other sessions/devices remain signed in (local scope, not global)
