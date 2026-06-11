## Why

LoreKeeper has a working data/auth/tRPC backend but no UI foundation: the app uses the
default Next.js starter styles, there are no shared components, no design tokens, and no
app shell. Before building campaign-management screens we need a consistent, accessible
UI layer so every later feature looks and behaves uniformly and meets a baseline of
accessibility. This change establishes that foundation and ships no business features.

## What Changes

- Install and configure **shadcn/ui** (Radix-based, accessible primitives) on the
  existing Tailwind v4 setup.
- Centralize **design tokens** (color, spacing, radius, typography, shadow) as CSS
  variables and a Tailwind theme. Support light/dark via CSS variables driven by
  `prefers-color-scheme`, with an explicit `.dark` class override for toggling.
- Build a responsive **app shell** (header, primary nav, content region) used by all
  authenticated pages, with skip-to-content and semantic landmarks.
- Add a consistent set of **primitives** from shadcn/ui — Button, Input, Textarea,
  Select, Dialog, Card, Toast, Skeleton — plus **EmptyState** and **ErrorState**
  components, each with a small, documented set of variants so usage stays uniform.
- Establish an **accessibility baseline**: focus-visible styles, full keyboard
  navigation, labelled form controls with associated error text, `aria-live` toasts, and
  `prefers-reduced-motion` handling.
- Add a global **error boundary** and a **not-found** page.

## Capabilities

### New Capabilities
- `design-system`: Design tokens (CSS variables + Tailwind theme), light/dark theming,
  the shadcn/ui primitive set (Button, Input, Textarea, Select, Dialog, Card, Toast,
  Skeleton, EmptyState, ErrorState) with documented variants, and the accessibility
  baseline (focus-visible, keyboard nav, labelled controls, aria-live, reduced motion).
- `app-shell`: The responsive authenticated layout (header, primary nav, content region)
  with skip-to-content and semantic landmarks, plus the global error boundary and
  not-found page.

### Modified Capabilities
<!-- None. This change is purely additive UI foundation; no existing capability's
     requirements change. -->

## Impact

- **Dependencies**: shadcn/ui primitives and their Radix peers, `class-variance-authority`,
  `clsx`, `tailwind-merge`, `lucide-react`, and a Tailwind v4 animation helper
  (`tw-animate-css`).
- **Config**: `components.json` (shadcn), `tailwind` theme tokens, a `cn()` utility.
- **New code**: `app/globals.css` token layer; `components/ui/*` primitives; `components/`
  shell (header/nav), `EmptyState`, `ErrorState`, a theme provider/toggle; `app/error.tsx`
  (global error boundary) and `app/not-found.tsx`.
- **Touched**: `app/layout.tsx` to mount the shell/theme and skip link; `app/globals.css`
  replaces the starter tokens.
- **Tests**: primitives render accessible markup; dark mode toggles via tokens; the error
  boundary catches render errors. (Component tests use a DOM environment.)
- No data, API, or auth changes; no business features.
