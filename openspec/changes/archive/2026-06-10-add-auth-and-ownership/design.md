## Context

After `add-data-foundation`, LoreKeeper has a Campaign aggregate with NPC/Session/
Location/Item/Character children and owner-less CRUD route handlers under
`app/api/campaigns/**`. There is no authentication: any caller reads/writes any
campaign. The database is Supabase Postgres, accessed exclusively through Prisma 7 with a
driver adapter (`lib/prisma.ts`, pooled `DATABASE_URL`); migrations run via
`prisma.config.ts` against `DIRECT_URL`. CLAUDE.md requires Prisma as the only data
layer (no raw SQL in app code), strict TypeScript, Zod at boundaries, server-only
secrets, and tests with every change. This change introduces Supabase Auth and per-user
ownership across the stack.

## Goals / Non-Goals

**Goals:**
- Authenticated sessions via Supabase Auth using `@supabase/ssr`, with browser + server
  clients and secure cookies.
- Middleware that refreshes the session and protects all routes except login/callback.
- Email auth (login, logout, callback) and a server-only `getCurrentUser()`.
- A required `Campaign.ownerId` and a migration for it.
- Owner-scoped reads/writes in the data layer; cross-user access returns 404.
- Supabase RLS with owner-keyed policies on all tables as defense-in-depth.

**Non-Goals:**
- OAuth/social providers, multi-factor auth, password reset UI polish.
- Organizations/teams/sharing or per-entity ACLs beyond single-owner.
- Moving any data access off Prisma; RLS is additive, not the primary check.
- AI features (still out of scope).
- Rich login UI styling — a minimal functional login page is enough.

## Decisions

- **`@supabase/ssr` cookie wiring.** Two factories: `lib/supabase/server.ts`
  (`createServerClient` reading/writing `cookies()`), and `lib/supabase/client.ts`
  (`createBrowserClient`, anon key only). The server client's cookie adapter sets
  `httpOnly`, `Secure`, `SameSite=Lax`. Alternative: hand-rolled JWT handling — rejected;
  `@supabase/ssr` is the supported path and avoids token-handling bugs.
- **Middleware-based protection.** `middleware.ts` calls `supabase.auth.getUser()` to
  refresh the session and redirects unauthenticated requests to `/login`. A `matcher`
  excludes static assets; the public allow-list is `/login` and `/auth/callback`.
  Alternative: per-route guards only — rejected as error-prone (easy to forget a route);
  middleware is the backstop and handlers still re-check ownership.
- **`getCurrentUser()` is server-only.** Lives in `lib/auth/getCurrentUser.ts`, marked
  `import "server-only"`, returns the Supabase user or null. Route handlers call it and
  return 401 when null (middleware already redirects browser navigations).
- **Owner scoping in a data-access module.** A `lib/data/campaigns.ts` module wraps Prisma
  so every query is parameterized by `ownerId`: list filters `where: { ownerId }`; get/
  update/delete use `where: { id, ownerId }`; NPC operations first resolve an owned parent
  campaign. A miss (wrong owner or absent) yields a not-found result the handler maps to
  404. Alternative: scatter `ownerId` filters across handlers — rejected; centralizing
  prevents an unscoped query slipping through.
- **404 over 403 for cross-user access.** Returning 404 avoids confirming that another
  user's campaign exists. The data layer treats unowned and missing identically.
- **`ownerId` always from the session.** Zod create/update schemas do not include
  `ownerId`; it is injected from `getCurrentUser()` at the handler. Any client-supplied
  `ownerId` is stripped by the existing `.strip()` behavior.
- **RLS as defense-in-depth.** A SQL migration enables RLS and adds owner-keyed policies:
  `Campaign` on `ownerId = auth.uid()`; child tables via a subquery to their parent
  campaign's `ownerId`. Because the app connects through Prisma with the pooled role,
  policies are written against the authenticated user id; the app layer remains the
  primary enforcement. Alternative: rely on RLS alone — rejected; Prisma's connection
  role and pooling make app-layer checks the dependable primary, with RLS as backstop.
- **Migration for existing rows.** The seeded sample campaign predates ownership. The
  migration adds `ownerId` as nullable, backfills existing rows with a designated seed
  owner id (a constant dev user), then sets `NOT NULL` and adds the index. The seed is
  updated to set `ownerId`.
- **Secrets.** `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are public;
  `SUPABASE_SERVICE_ROLE_KEY` is server-only and never imported in client code or
  returned in responses. `.env.example` documents all three.

## Risks / Trade-offs

- **RLS vs. Prisma connection role** → if Prisma connects as a privileged role, RLS may
  not constrain it; mitigate by treating the app-layer owner scoping as primary and
  documenting RLS as defense-in-depth, and by writing policies against `auth.uid()`.
- **Backfilling `ownerId` on existing rows** → a non-null column needs values for old
  rows; mitigate with the nullable→backfill→not-null sequence and a constant seed owner.
- **Middleware gaps** → a forgotten public route could lock out auth, or a missed
  protected route could leak; mitigate with an explicit allow-list and handler-level
  re-checks via `getCurrentUser()` so middleware is not the only guard.
- **Service-role key leakage** → mitigate by importing it only in server modules, never in
  files reachable from client components, and asserting its absence from client bundles in
  tests where feasible.
- **Test auth without a live browser** → mock `getCurrentUser()` and the owner-scoped data
  layer in unit tests; keep RLS verification as opt-in/local DB-integration tests gated on
  `DIRECT_URL` (consistent with the existing test strategy).

## Migration Plan

1. Add `@supabase/supabase-js` and `@supabase/ssr`; add Supabase env vars to `.env`/
   `.env.example`.
2. Add `lib/supabase/{server,client}.ts`, `lib/auth/getCurrentUser.ts`, `middleware.ts`,
   and auth routes (`app/login`, `app/auth/callback`, logout).
3. Add `Campaign.ownerId` to the Prisma schema; generate the migration (nullable →
   backfill seed owner → `NOT NULL` + index). Update the seed.
4. Add the RLS enable + policies migration (raw SQL migration file).
5. Add `lib/data/campaigns.ts` owner-scoped data access; update `app/api/campaigns/**`
   handlers to require auth and use it.
6. Update existing tests; add auth/ownership/RLS tests. Run `npx tsc --noEmit` and the
   suite.
- **Rollback:** revert the ownerId/RLS migrations and remove auth modules; the prior
  owner-less foundation is restored (dev data only).

## Open Questions

- Magic link vs. email+password as the default email method? Either satisfies the spec;
  defaulting to magic link for less credential handling unless the team prefers passwords.
- Which constant id to use as the seed/dev owner for backfilling existing rows — a fixed
  placeholder uuid is assumed.
