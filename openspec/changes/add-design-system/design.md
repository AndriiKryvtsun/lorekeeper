## Context

LoreKeeper's backend (Prisma data, Supabase auth, tRPC) is in place, but the frontend is
the default Next.js starter: `app/globals.css` has two ad-hoc tokens, there is no
component library, no app shell, and no error/not-found UI. Tailwind v4 is already
installed (`@import "tailwindcss"`, `@theme inline`, `@tailwindcss/postcss`). The project
uses two path aliases: `@/* → ./*` (root: `app/`, `lib/`, `components/`) and `~/* → ./src/*`
(tRPC/env). CLAUDE.md requires strict TypeScript, server components by default, and tests
with every change. This change adds an accessible UI foundation only — no business
features.

## Goals / Non-Goals

**Goals:**
- shadcn/ui configured on Tailwind v4 with centralized CSS-variable tokens + theme.
- Light/dark theming via tokens, following `prefers-color-scheme` with an explicit toggle.
- A responsive app shell (header/nav/main) with skip-to-content and landmarks.
- The primitive set (Button, Input, Textarea, Select, Dialog, Card, Toast, Skeleton) plus
  `EmptyState`/`ErrorState`, with documented variants.
- Accessibility baseline (focus-visible, keyboard nav, labelled controls + error text,
  aria-live toasts, reduced motion).
- Global error boundary and not-found page.

**Non-Goals:**
- Any campaign/NPC/feature screens or wiring real data into the shell.
- Auth UI beyond what already exists (login lives in Change 2).
- A full component gallery/Storybook; "documented variants" means concise inline docs.
- Custom-designed iconography (use `lucide-react`).

## Decisions

- **shadcn/ui on Tailwind v4 (CSS-variables, new-york style).** Initialize `components.json`
  with the CSS-variables theme; primitives are generated into `components/ui/*` and owned
  in-repo. Uses `tw-animate-css` (the Tailwind v4 successor to `tailwindcss-animate`).
  Alternative: hand-rolled components or a runtime library (MUI) — rejected; shadcn gives
  accessible Radix primitives we control and that match Tailwind tokens.
- **Tokens as CSS variables mapped through `@theme inline`.** `app/globals.css` defines a
  `:root` light token set and a dark token set; tokens cover color, spacing, radius,
  typography, and shadow. Components reference Tailwind classes bound to these variables.
- **Theming with `next-themes` + media-query fallback.** Use `next-themes`
  (`attribute="class"`, `defaultTheme="system"`, `enableSystem`) so the theme follows
  `prefers-color-scheme` and can be toggled explicitly by adding/removing `.dark`. A
  `@media (prefers-color-scheme: dark)` block provides a no-JS fallback. Alternative:
  pure CSS media query only — rejected because the spec/tests require an explicit toggle.
- **`cn()` utility** in `lib/utils.ts` (`clsx` + `tailwind-merge`), the shadcn convention;
  variants via `class-variance-authority`. shadcn aliases resolve under `@/` (root), where
  `components/` and `lib/` live; `~/` stays reserved for the tRPC/env layer.
- **App shell as a server component.** `components/app-shell.tsx` renders `header[banner]`,
  `nav`, and `main` landmarks and a skip-to-content link targeting `#main`. The shell is
  composed by the (future) authenticated layout; this change wires it into `app/layout.tsx`
  for now. The nav collapses on small viewports (CSS/Radix, no data).
- **Error handling: a reusable `ErrorBoundary` + Next files.** A class `ErrorBoundary`
  component renders `ErrorState` when a descendant throws (this is what the tests exercise).
  `app/error.tsx` (segment boundary) and `app/global-error.tsx` delegate to `ErrorState`
  with a `reset` action; `app/not-found.tsx` renders an `EmptyState`-style not-found using
  the shell. Rationale: Next's own `error.tsx` is auto-wired but hard to unit-test, so the
  reusable boundary gives a testable unit and a single error UI.
- **Accessibility baseline baked into primitives.** Radix gives roles/focus management;
  we add global `:focus-visible` token styles, ensure form primitives wire
  `label`/`aria-describedby`/`aria-invalid`, render Toasts in an `aria-live` region
  (Radix Toast viewport), and add a `prefers-reduced-motion` CSS guard.
- **Testing with jsdom + Testing Library.** Add `@testing-library/react`,
  `@testing-library/jest-dom`, and `jsdom`; run component tests (`*.test.tsx`) in a jsdom
  environment via a per-file `// @vitest-environment jsdom` pragma (keeping existing node
  tests unchanged). Tests assert accessible markup, token-driven dark mode, and that the
  `ErrorBoundary` catches a throwing child.

## Risks / Trade-offs

- **shadcn CLI vs. Tailwind v4 / Next 16** → the CLI may assume a `src/` layout or older
  Tailwind; mitigate by configuring `components.json` for our root layout and generating
  primitives, then hand-adjusting imports/tokens as needed (components are owned in-repo).
- **`next-themes` + SSR hydration flash** → mitigate with `suppressHydrationWarning` on
  `<html>` and the provider's standard setup.
- **Two dark-mode mechanisms (class + media query)** → keep the class (toggle) as the
  source of truth with the media query only as a no-JS fallback, to avoid conflicting
  states.
- **Mixed test environments (node + jsdom)** → use per-file environment pragmas so the
  existing node-based tests are unaffected.
- **`app/error.tsx`/`global-error.tsx` must be client components** → keep them thin
  wrappers over `ErrorState`; the shell and pages stay server components.

## Migration Plan

1. Install shadcn deps + Testing Library/jsdom; `shadcn init` → `components.json`, `cn()`.
2. Replace `app/globals.css` tokens with the full token set + dark + reduced-motion.
3. Generate primitives (Button, Input, Textarea, Select, Dialog, Card, Toast, Skeleton);
   add `EmptyState`, `ErrorState`, `ErrorBoundary`, theme provider/toggle.
4. Build the app shell; wire it, the theme provider, and the skip link into `app/layout.tsx`.
5. Add `app/error.tsx`, `app/global-error.tsx`, `app/not-found.tsx`.
6. Add component tests (accessible markup, dark-mode tokens, error boundary); run
   `npx tsc --noEmit` and the suite; confirm `next build`.
- **Rollback:** remove `components/`, `components.json`, the new app files, and restore the
  starter `globals.css`. No backend impact.

## Open Questions

- Default theme: follow system (chosen) vs. force a brand default? Defaulting to `system`.
- Primary nav contents are placeholders until feature screens exist — assumed minimal
  (app name + a couple of stub links) since this change ships no features.
