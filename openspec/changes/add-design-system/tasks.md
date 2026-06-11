## 1. Install & initialize

- [x] 1.1 Add UI deps: `class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-react`, `tw-animate-css`, `next-themes`, and the Radix peers used by the chosen primitives
- [x] 1.2 Initialize shadcn/ui (`components.json`, CSS-variables theme, root `@/` aliases); add `cn()` in `lib/utils.ts`
- [x] 1.3 Add test deps: `@testing-library/react`, `@testing-library/jest-dom`, `jsdom`; ensure Vitest runs `*.test.tsx` in jsdom via per-file pragma

## 2. Design tokens & theming

- [x] 2.1 Replace `app/globals.css` with the full token set (color, spacing, radius, typography, shadow) as CSS variables mapped via `@theme inline`
- [x] 2.2 Add dark token values under `.dark` and a `@media (prefers-color-scheme: dark)` no-JS fallback
- [x] 2.3 Add global `:focus-visible` styles and a `prefers-reduced-motion` guard
- [x] 2.4 Add a `next-themes` provider (`attribute="class"`, `defaultTheme="system"`, `enableSystem`) and a theme toggle; set `suppressHydrationWarning` on `<html>`

## 3. Primitives

- [x] 3.1 Generate/author primitives in `components/ui/`: Button, Input, Textarea, Select, Dialog, Card, Toast, Skeleton — with documented variants (CVA)
- [x] 3.2 Ensure form primitives associate `label` and link error text via `aria-describedby`/`aria-invalid`; Dialog has an accessible name + focus management
- [x] 3.3 Render Toasts in an `aria-live` region (Radix Toast viewport) and mount the toaster
- [x] 3.4 Add `EmptyState` and `ErrorState` components with documented variants

## 4. App shell & error/not-found

- [x] 4.1 Build `components/app-shell.tsx`: `header[banner]`, primary `nav`, `main#main` content region; responsive/collapsible nav
- [x] 4.2 Add a skip-to-content link that moves focus to `#main`
- [x] 4.3 Add a reusable `ErrorBoundary` (class) that renders `ErrorState` on a caught error
- [x] 4.4 Add `app/error.tsx` and `app/global-error.tsx` (thin client wrappers over `ErrorState` with `reset`) and `app/not-found.tsx` (not-found UI within the shell)
- [x] 4.5 Wire the theme provider, shell, skip link, and toaster into `app/layout.tsx`

## 5. Tests

- [x] 5.1 Primitives render accessible markup: a labelled Input links its error via `aria-describedby`/`aria-invalid`; Button is keyboard-operable with an accessible name; Dialog exposes role + name
- [x] 5.2 Dark mode toggles via tokens: applying the `.dark` class changes the resolved token values / themed output
- [x] 5.3 `ErrorBoundary` catches a throwing child and renders `ErrorState`
- [x] 5.4 Skip-to-content link targets the `main` landmark; shell exposes banner/nav/main landmarks

## 6. Verification

- [x] 6.1 Run `npx tsc --noEmit` and fix any type errors (no `any`)
- [x] 6.2 Run the Vitest suite (node + jsdom) and confirm all tests pass
- [x] 6.3 Confirm `next build` succeeds and the app renders the shell, light/dark, and not-found
