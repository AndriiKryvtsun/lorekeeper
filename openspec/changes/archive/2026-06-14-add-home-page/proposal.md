## Why

The root route `/` is still the default Next.js starter page, and the auth proxy doesn't treat
`/` as public — so an anonymous visitor is bounced to `/sign-in` and there is no real entry
point. The app needs a proper home page: the single public, indexable surface that explains
the product and routes people to sign up or in.

## What Changes

- Replace the starter `app/page.tsx` with a real home route whose behavior is decided
  SERVER-side (no flash): authenticated requests redirect to `/campaigns`; anonymous requests
  render the public landing.
- **BREAKING** (routing): `/` becomes public in the auth proxy; every other non-`(auth)`
  route stays gated.
- Build the landing as a Server Component (static/cacheable, no per-user data): a hero with
  the value proposition and primary CTAs to `/sign-up` and `/sign-in`; concise feature
  highlights (campaign + entity management, the grounded per-campaign AI assistant, automatic
  session summaries); and a footer — all from the design system, light + dark.
- Add `generateMetadata` for `/` (title, description, canonical, Open Graph/Twitter) and make
  `/` the ONLY indexable page; the rest of the app is `noindex`.
- Meet accessibility (one `h1`, semantic landmarks, keyboard + visible focus, AA contrast,
  alt text, `prefers-reduced-motion`, responsive, skip-to-content) and performance (`next/image`,
  `next/font`, no layout shift, minimal client JS) bars.

## Capabilities

### New Capabilities
- `home-page`: the public landing at `/`, its server-side auth-state routing
  (authed → `/campaigns`, anon → landing), SEO metadata + app-wide indexability policy
  (only `/` indexed), and its accessibility/performance/privacy guarantees.

### Modified Capabilities
- `user-auth`: the auth proxy's public-route set now includes `/` (the home page), so an
  anonymous visitor reaches the landing instead of being redirected to `/sign-in`.

## Impact

- **Code**: rewrites `app/page.tsx` (server auth-state routing + landing composition); new
  landing section components under `components/` built from the design system; `proxy.ts`
  public-paths update; root-layout metadata gains a default `noindex` with `/` overriding to
  indexable via `generateMetadata`; a reachable skip-to-content target.
- **Routing/SEO**: `/` is public and indexable; all other routes remain gated and `noindex`.
- **Security/privacy**: no secrets or auth logic on the client; no third-party trackers
  without consent; the existing CSP applies; session is still resolved server-side.
- **Dependencies**: none new (design-system primitives, `next/image`, `next/font`, Supabase
  server client already present).
