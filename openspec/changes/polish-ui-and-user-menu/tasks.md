## 1. Token layer & visual identity

- [x] 1.1 Extend the CSS-variable token layer with a refined type scale, spacing rhythm, radius scale, and elevation/shadow scale
- [x] 1.2 Add accent color and gradient tokens for the dark-fantasy/arcane identity, and map all new tokens into the Tailwind theme
- [x] 1.3 Add motion duration and easing tokens (consumed by the motion layer)
- [x] 1.4 Tune dark mode as a first-class theme (independent values, not inverted) and verify the `.dark`/`prefers-color-scheme` switch still works without markup changes
- [x] 1.5 Audit primitives to ensure they reference the new tokens (no one-off literals introduced)

## 2. Motion layer

- [x] 2.1 Define a CSS motion layer (via `tw-animate-css` + motion tokens) for page/section transitions, list-item entrance, and dialog/widget open, using transform/opacity only (no layout shift)
- [x] 2.2 Add hover/press micro-interactions to interactive primitives using transform/opacity
- [x] 2.3 Add a global `prefers-reduced-motion: reduce` override that neutralizes all motion-layer animation/transition (including Radix `data-state` animations)
- [x] 2.4 Confirm no new animation dependency is added (CSS only)

## 3. Component states & iconography

- [x] 3.1 Elevate `EmptyState` with light iconography/illustration and mark decorative visuals `aria-hidden`
- [x] 3.2 Refine skeleton/loading states for consistency across views
- [x] 3.3 Apply consistent token-driven hover/active/`focus-visible` styling across primitives and preserve visible focus rings
- [x] 3.4 Standardize on lucide iconography across primitives

## 4. User menu (app-shell header)

- [x] 4.1 Add `@radix-ui/react-dropdown-menu` and create a shadcn-style `DropdownMenu` primitive
- [x] 4.2 Build an avatar user-menu component showing the user's avatar + display name (read-only from existing profile data)
- [x] 4.3 Add menu items: Profile (link), theme toggle (via `next-themes`), and Sign out, with correct menu semantics and full keyboard operability (open/close, arrow nav, activation, focus return to trigger)
- [x] 4.4 Mount the user menu in the app-shell header

## 5. Local-scope sign out

- [x] 5.1 Add a Server Action that calls the server Supabase client `signOut({ scope: 'local' })` and redirects to the sign-in/landing page
- [x] 5.2 Wire the user-menu Sign out item to the local-scope action
- [x] 5.3 Add a "Sign out" (current session) button on the profile page, presented distinctly from the existing global "sign out of all other devices"

## 6. Tests & verification

- [x] 6.1 Test the user menu exposes correct menu roles and is keyboard-operable
- [x] 6.2 Test Sign out ends the current session (local scope), redirects, and leaves other sessions intact
- [x] 6.3 Test `prefers-reduced-motion` disables motion-layer animations
- [x] 6.4 Run automated a11y checks (axe) on key screens and assert they pass
- [x] 6.5 Assert AA contrast holds on the new palette in both themes, including text over gradients/imagery
- [x] 6.6 Assert no data model, tRPC procedure, assistant, or security behavior changed (presentation-only invariant)
- [x] 6.7 Run `npx tsc --noEmit` and the full test suite

