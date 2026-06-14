## Context

`app/page.tsx` is still the Next.js starter, and the auth proxy (`proxy.ts`) does not list `/`
as public, so anonymous visitors to `/` are redirected to `/sign-in`. The root layout
(`app/layout.tsx`) currently mounts `AppShell` (app header, "Campaigns" nav, a skip link, and a
`<main>`) around EVERY route — even though the `app-shell` spec scopes the shell to
"authenticated pages." This change adds a real public landing at `/` and corrects that
mounting so the landing can own its own landmarks.

## Goals / Non-Goals

**Goals:**
- A server-decided `/`: authed → `/campaigns`, anon → public landing (no flash).
- A static, accessible, design-system landing that is the single indexable surface.
- `/` public in the proxy; everything else stays gated and `noindex`.

**Non-Goals:**
- No marketing CMS, blog, pricing, or i18n.
- No redesign of the authenticated app shell or auth pages.
- No new analytics/tracking.

## Decisions

### 1. Server-side branching in the `/` route
`app/page.tsx` becomes an async Server Component that resolves the session via the existing
`getCurrentUser()` and, if present, calls `redirect("/campaigns")` before any markup renders;
otherwise it renders the landing. Rationale: the decision happens on the server, so there is no
client flash and no per-user data reaches the landing. Alternative considered: client-side
redirect (rejected — causes a flash and ships needless JS).

### 2. Relocate `AppShell` to the authenticated `(app)` route group
Move `AppShell` from `app/layout.tsx` into `app/(app)/layout.tsx`, leaving the root layout
chrome-neutral (html/body, fonts, providers, Toaster). Rationale: this matches the EXISTING
`app-shell` spec ("wraps all authenticated pages") — the current root mounting is over-broad —
and it frees the landing (and the `(auth)` pages, which already use their own `AuthShell`) to
supply their own `header`/`nav`/`main`/`footer` and a single `h1`/`<main>`. Without this, the
landing would be nested inside the shell's `<main>` and expose the app's "Campaigns" nav to
anonymous visitors (duplicate landmarks + wrong nav). Alternative considered: make `AppShell`
conditionally render nothing on `/` (rejected — it is a server component with no auth/route
awareness, and the conditional would leak app concerns into every page).

### 3. Indexability: default `noindex`, `/` opts in
Set a default `robots: { index: false, follow: false }` in the root layout metadata, and have
`/`'s `generateMetadata` override with `robots: { index: true, follow: true }` plus canonical
and Open Graph/Twitter. Rationale: makes `/` the only indexable page with one small override,
rather than annotating every other route. Canonical/OG base URL comes from server config (not a
client secret).

### 4. Proxy public-path addition is exact-match safe
Add `/` to the proxy's public set. The existing `matches()` helper treats an entry `p` as
`pathname === p || pathname.startsWith(`${p}/`)`; for `p = "/"` the prefix form becomes `"//"`,
which no real path starts with, so only the exact root `/` is matched — it does NOT make every
route public. The home route still redirects authed users itself (Decision 1).

### 5. Landing composition and performance
The landing is composed from design-system primitives as small server components (hero, feature
highlights, footer) with exactly one `h1`. Imagery uses `next/image` with explicit dimensions
(no layout shift); fonts use the existing `next/font` setup. Any hero motion is CSS-only and
gated behind `motion-reduce:` (honoring `prefers-reduced-motion`). The only client island is the
existing `ThemeToggle`; everything else is RSC. A skip-to-content link targets the landing's
`<main id="main">`.

## Risks / Trade-offs

- **Moving `AppShell` could regress authenticated-page chrome** → Covered by the existing
  app-shell layout test plus a check that an `(app)` page still renders the shell; the `(auth)`
  pages already render via `AuthShell`, so they are unaffected.
- **An automated a11y library may not be installed** → If `vitest-axe`/`jest-axe` is unavailable,
  assert accessibility structurally (exactly one `h1`; header/nav/main/footer landmarks; image
  `alt`; reachable skip link) rather than skipping the check; add the axe dependency only if
  desired.
- **Canonical/OG URLs need a base origin** → Read it from existing server env/config, never a
  client secret; default sensibly if unset so the build never leaks or breaks.

## Open Questions

- Final hero imagery/illustration asset is a content choice; the implementation uses a
  lightweight placeholder with proper `alt` and dimensions until a real asset is supplied.
