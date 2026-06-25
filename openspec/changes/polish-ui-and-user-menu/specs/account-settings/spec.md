## ADDED Requirements

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
