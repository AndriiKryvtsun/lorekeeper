## Why

The app is functionally complete but visually generic: the design tokens carry only
the baseline needed for accessibility, there is no motion layer, empty/loading states
are bare, and there is no in-shell way to see who is signed in or to sign out of the
current session. A cohesive dark-fantasy aesthetic and a polished, accessible user
menu raise perceived quality without touching any data, procedure, or security
behavior — and doing it through the existing token layer keeps the "one design system"
bar intact.

## What Changes

- Extend the existing design-token layer with a refined dark-fantasy/arcane visual
  identity: refined type scale, spacing rhythm, elevation/shadow scale, radius scale,
  and accent colors/gradients — all as tokens, so polish applies uniformly. No
  one-off styles.
- Make dark mode a first-class, tuned theme (not just inverted values), maintaining
  AA contrast on the new palette and on text over gradients/imagery.
- Add a subtle, fast motion layer (at most one small animation dependency, or CSS)
  for page/section transitions, list-item entrance, dialog/widget open, and
  hover/press micro-interactions. Every animation uses transform/opacity only (no
  layout shift), short durations, and a reduced/none variant under
  `prefers-reduced-motion`.
- Elevate empty states (light iconography/illustration), refine skeletons, and add
  consistent hover/active/focus styling plus lucide iconography across primitives.
- Add an accessible avatar dropdown (shadcn/Radix dropdown menu) in the app-shell
  header showing the user's avatar + display name, with items **Profile**, a **theme
  toggle**, and **Sign out**.
- **Sign out** from the menu ends the CURRENT session only (local-scope `signOut`)
  via a Server Action, then redirects to the sign-in/landing page — distinct from the
  profile's existing global "sign out everywhere".
- Add a "Sign out" (current session) button on the profile page.

Non-goals: no changes to data models, tRPC procedures, the assistant pipeline, or any
security control; no new data is read or written; behavior of existing procedures is
unchanged.

## Capabilities

### New Capabilities

_None._ All work extends existing capabilities so the single design system holds and
no new data/procedure surface is introduced.

### Modified Capabilities

- `design-system`: refine and extend the token layer (type scale, spacing, elevation/
  shadow, radius, accent colors/gradients) for a cohesive dark-fantasy identity; make
  dark mode a first-class theme; add a motion layer (entrance/transition/open and
  hover/press micro-interactions) governed by `prefers-reduced-motion` using
  transform/opacity only; elevate empty states and skeletons; add consistent
  hover/active/focus styling and lucide iconography; maintain AA contrast on the new
  palette including text over gradients/imagery.
- `app-shell`: add an accessible avatar user-menu (Radix dropdown) in the header that
  surfaces the signed-in user's avatar + display name with Profile, theme-toggle, and
  Sign-out items; Sign out ends the current session (local scope) via a Server Action
  and redirects to sign-in/landing; the menu has correct menu semantics and is fully
  keyboard-operable.
- `account-settings`: add a "sign out (current session)" affordance on the profile
  page, distinct from the existing global "sign out of all other devices".

## Impact

- **Affected specs:** `design-system`, `app-shell`, `account-settings`.
- **Affected code:** global token/theme CSS and Tailwind theme mapping; shared
  primitives (Button, Card, Dialog, Skeleton, EmptyState, ErrorState) for states and
  iconography; app-shell header (new user-menu component); profile page (sign-out
  button); a new local-scope `signOut` Server Action reusing the auth-ui server-client
  pattern.
- **Dependencies:** at most one small animation library (e.g. a lightweight motion
  helper) or pure CSS; `lucide-react` for iconography; existing shadcn/Radix dropdown.
- **Unaffected:** data models, Prisma schema, tRPC routers/procedures, assistant
  pipeline, and all security controls — verified by tests asserting no data/procedure/
  security behavior changed.
- **Performance:** no Core Web Vitals regression — cheap transform/opacity animations,
  optimized images, ≤1 small animation dependency.
