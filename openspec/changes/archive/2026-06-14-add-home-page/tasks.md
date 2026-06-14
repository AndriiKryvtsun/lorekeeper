## 1. Routing & shell mounting

- [x] 1.1 Add `/` to the proxy public paths in `proxy.ts` (exact-match safe), so anonymous visitors reach the landing; keep every other non-`(auth)` route gated
- [x] 1.2 Relocate `AppShell` from `app/layout.tsx` into `app/(app)/layout.tsx`; make the root layout chrome-neutral (html/body, fonts, providers, Toaster) so the landing and `(auth)` pages own their own landmarks
- [x] 1.3 Verify the `(auth)` pages still render via their own `AuthShell` and authenticated `(app)` pages still render the shell

## 2. Home route (server-side auth-state routing)

- [x] 2.1 Rewrite `app/page.tsx` as an async Server Component: resolve the session via `getCurrentUser()`; if authenticated, `redirect("/campaigns")` before render; otherwise render the landing (no client flash, no per-user data)

## 3. Landing UI (design system, RSC)

- [x] 3.1 Build the landing from design-system primitives: semantic `header`/`nav`/`main`/`footer`, a hero with exactly one `h1` + value proposition and primary CTAs to `/sign-up` and `/sign-in`, and a reachable skip-to-content link to `<main id="main">`
- [x] 3.2 Add concise feature highlights (campaign + entity management, the grounded per-campaign AI assistant, automatic session summaries) and a footer; correct in light and dark themes
- [x] 3.3 Use `next/image` (explicit dimensions, alt text, no layout shift) and `next/font`; gate any hero motion behind `motion-reduce:`; keep client JS minimal (RSC; only the existing `ThemeToggle` as a client island)

## 4. SEO & indexability

- [x] 4.1 Add `generateMetadata` for `/`: title, description, canonical, Open Graph/Twitter; mark `/` indexable
- [x] 4.2 Set a default `noindex` for the rest of the app (root-layout metadata `robots: { index: false }`), so `/` is the only indexable page

## 5. Tests

- [x] 5.1 Authenticated request to `/` redirects to `/campaigns` (mock `getCurrentUser`; assert `redirect` called, landing not rendered)
- [x] 5.2 Anonymous request to `/` renders the landing with the hero `h1` and CTAs to `/sign-up` and `/sign-in`
- [x] 5.3 `/` metadata is present (title, description, canonical, Open Graph/Twitter) and marks `/` indexable while a representative other route is `noindex`
- [x] 5.4 The landing has exactly one `h1` and passes an automated a11y check (axe if available; else structural landmark/h1/alt/skip-link assertions) (jsdom)
- [x] 5.5 No client-side secret usage on the landing (no secret env references; landing components are server except the theme-toggle island)
- [x] 5.6 Proxy allows `/` for anonymous users while still redirecting other protected routes to `/sign-in`

## 6. Verification

- [x] 6.1 Run `npx tsc --noEmit` and fix any type errors (no `any`)
- [x] 6.2 Run the Vitest suite (node + jsdom) and confirm all tests pass
- [x] 6.3 Confirm `next build` succeeds; `/` is static/public and indexable, other routes remain gated and `noindex`
