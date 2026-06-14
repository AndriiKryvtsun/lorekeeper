# home-page

## Purpose

Defines the application's root (`/`) route: server-side auth-state routing, the
public marketing landing for anonymous visitors, SEO/indexability policy,
accessibility, performance, and security/privacy expectations.

## Requirements

### Requirement: Server-side auth-state routing at the root
The `/` route SHALL resolve the Supabase session on the SERVER and branch before rendering, so
no client-side flash occurs. An authenticated request SHALL be redirected to `/campaigns`; an
unauthenticated request SHALL render the public landing.

#### Scenario: Authenticated visitor is redirected to the dashboard
- **WHEN** an authenticated user requests `/`
- **THEN** the server redirects them to `/campaigns` without rendering the landing

#### Scenario: Anonymous visitor sees the landing
- **WHEN** an unauthenticated user requests `/`
- **THEN** the public landing is rendered

#### Scenario: No auth-state flash
- **WHEN** the root route decides what to show
- **THEN** the decision is made server-side before render, so the user never sees a flash of the wrong state

### Requirement: Public landing content
The landing SHALL be a Server Component that uses NO per-user data (static/cacheable). It SHALL
present a hero with the product value proposition and primary calls-to-action linking to
`/sign-up` and `/sign-in`, concise feature highlights (campaign + entity management, the
grounded per-campaign AI assistant, and automatic session summaries), and a footer. It SHALL be
composed from the design system and render correctly in light and dark themes.

#### Scenario: Landing presents value proposition and CTAs
- **WHEN** the landing renders
- **THEN** it shows a hero value proposition and primary CTAs to `/sign-up` and `/sign-in`

#### Scenario: Landing lists the core feature highlights
- **WHEN** the landing renders
- **THEN** it shows highlights for campaign/entity management, the grounded AI assistant, and automatic session summaries, plus a footer

#### Scenario: Landing uses no per-user data
- **WHEN** the landing is rendered for any visitor
- **THEN** it reads no per-user data and is safe to cache as a static surface

### Requirement: SEO metadata and app-wide indexability policy
The `/` route SHALL provide metadata via `generateMetadata` including title, description,
canonical URL, and Open Graph/Twitter tags. `/` SHALL be the ONLY indexable page; every other
route SHALL be `noindex`.

#### Scenario: Home metadata is present
- **WHEN** `/` is requested
- **THEN** the response includes title, description, canonical, and Open Graph/Twitter metadata

#### Scenario: Only the home page is indexable
- **WHEN** any route other than `/` is requested
- **THEN** its metadata marks it `noindex`, while `/` is indexable

### Requirement: Accessible landing
The landing SHALL have exactly one `h1` with a logical heading order; semantic
`header`/`nav`/`main`/`footer` landmarks; keyboard-operable navigation and CTAs with visible
focus; AA color contrast; alt text on imagery; and a reachable skip-to-content target. Hero
motion SHALL respect `prefers-reduced-motion`, and the layout SHALL be mobile-first responsive.

#### Scenario: Single h1 and logical landmarks
- **WHEN** the landing is rendered
- **THEN** it has exactly one `h1` and semantic header/nav/main/footer landmarks

#### Scenario: Keyboard and reduced-motion support
- **WHEN** a user navigates by keyboard or has `prefers-reduced-motion` set
- **THEN** nav and CTAs are operable with visible focus and hero motion is reduced/disabled

#### Scenario: Passes automated accessibility checks
- **WHEN** the landing is run through an automated a11y check
- **THEN** it reports no violations (single h1, contrast, alt text, skip link)

### Requirement: Performance and minimal client JavaScript
The landing SHALL keep client JavaScript minimal (render as a React Server Component), use
`next/image` and `next/font`, and avoid layout shift.

#### Scenario: RSC with optimized assets
- **WHEN** the landing is built
- **THEN** it ships minimal client JS and uses `next/image` and `next/font` with no layout shift

### Requirement: Landing security and privacy
The landing SHALL contain no secrets or auth logic on the client, SHALL load no third-party
trackers without consent, and SHALL operate under the application's Content Security Policy.

#### Scenario: No client secrets or unconsented trackers
- **WHEN** the landing is served
- **THEN** it exposes no secrets/auth logic to the client and loads no third-party trackers without consent, consistent with the CSP
