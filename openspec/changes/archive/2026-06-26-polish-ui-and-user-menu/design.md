## Context

The app already ships a token-driven design system (CSS variables mapped into the
Tailwind theme), shadcn/Radix primitives, `next-themes` for theme switching,
`lucide-react` for icons, and `tw-animate-css` for CSS animations. Authentication runs
through the server Supabase client; `signOut` already exists as a Server Action pattern
(auth-ui), and account-settings owns the global "sign out of all other devices".

This change is presentation-only plus one sign-out affordance. The hard constraints:
extend the EXISTING token layer rather than adding one-off styles, keep AA contrast,
honor `prefers-reduced-motion`, add at most one small animation dependency, and change
no data model, tRPC procedure, assistant pipeline, or security control.

## Goals / Non-Goals

**Goals:**
- A cohesive dark-fantasy/arcane identity expressed entirely through refined design
  tokens (type, spacing, elevation, radius, accent colors, gradients).
- Dark mode as a first-class, tuned theme with AA contrast (including text over
  gradients/imagery).
- A subtle, fast motion layer (entrance, transitions, dialog/widget open, hover/press)
  using transform/opacity only, with a `prefers-reduced-motion` fallback for every
  animation.
- Elevated empty states, refined skeletons, consistent hover/active/focus styling, and
  lucide iconography.
- An accessible avatar user menu in the header (Profile, theme toggle, Sign out) and a
  current-session (local-scope) sign-out from the menu and the profile page.

**Non-Goals:**
- No changes to data models, Prisma schema, tRPC procedures, or the assistant pipeline.
- No change to any security control or to the existing global "sign out everywhere".
- No redesign of information architecture or new routes (besides reusing existing
  Profile/sign-in routes).

## Decisions

### Motion layer: CSS via `tw-animate-css` (no new dependency)
Use the already-installed `tw-animate-css` plus token-defined duration/easing variables
for entrance/transition/open and hover/press micro-interactions. All animations animate
only `transform`/`opacity`. A single global `@media (prefers-reduced-motion: reduce)`
rule neutralizes animation/transition durations, and Radix's `data-state` attributes
drive open/close animations so they inherit the same reduced-motion fallback.
- _Alternative considered:_ `framer-motion`. Rejected — it adds JS weight and risks a
  CWV regression for effects CSS handles; the proposal caps us at one small dependency,
  and we can stay at zero.

### Theme toggle: reuse `next-themes`
The theme toggle in the user menu calls `next-themes` `setTheme`, toggling the `.dark`
class on the document. Dark tokens are tuned independently (first-class), not derived by
inversion. SSR-safe mounting avoids hydration flash.
- _Alternative considered:_ a bespoke cookie/class toggle. Rejected — `next-themes` is
  already a dependency and handles system preference + persistence.

### Tokens extended in place
Add accent/gradient tokens, an elevation/shadow scale, a refined radius and type/spacing
scale, and motion duration/easing tokens to the existing CSS-variable layer and Tailwind
theme mapping. Components consume tokens; no per-component literals. Contrast is verified
against the new palette (including over gradients) as part of the a11y test pass.

### User menu: `@radix-ui/react-dropdown-menu`
Add `@radix-ui/react-dropdown-menu` (a UI primitive, not an animation dependency) as a
shadcn-style `DropdownMenu`. The trigger is an avatar button with an accessible name; the
content lists Profile (link), the theme toggle, and Sign out. Radix provides menu roles,
roving focus, type-ahead, and focus return to the trigger. The avatar + display name are
read from the existing profile data already available to the shell — read-only, no new
query surface required.

### Local-scope sign out via Server Action
Add a Server Action that calls the server Supabase client's `signOut({ scope: 'local' })`
and then `redirect()`s to the sign-in/landing page. This reuses the auth-ui server-client
pattern and is deliberately distinct from the global "other devices" action. The menu
item and the profile-page button both invoke this action.

## Risks / Trade-offs

- **Contrast regressions on the new palette / text over gradients** → Add automated a11y
  checks (axe) on key screens and verify AA on the chosen accent/gradient tokens in both
  themes; never rely on color alone (pair with icon/text).
- **Animation jank or CWV regression** → Restrict to transform/opacity, keep durations
  short, add no JS animation dependency; verify no layout shift.
- **Reduced-motion gaps** → Centralize the `prefers-reduced-motion` override at the token/
  global layer so every animation (including Radix `data-state` ones) inherits it; test it.
- **Theme hydration flash** → Use `next-themes` with proper SSR mounting.
- **Scope confusion between local and global sign-out** → Distinct labels and a dedicated
  local-scope action; tests assert other sessions are unaffected.
- **Accidental behavior change** → Tests assert no data/procedure/security behavior
  changed (presentation-only invariant).

## Migration Plan

No data migration. Ship token/theme/motion refinements and the user menu together; the
new local-scope Server Action is additive. Rollback is a straightforward revert — no
schema or procedure changes to unwind.

## Open Questions

- Final accent/gradient palette values (to be fixed during token implementation, then
  contrast-verified) — does not block the spec.
