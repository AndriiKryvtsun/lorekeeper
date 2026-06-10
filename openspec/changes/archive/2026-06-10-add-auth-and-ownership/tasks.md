## 1. Dependencies & configuration

- [x] 1.1 Add `@supabase/supabase-js` and `@supabase/ssr` to dependencies; `npm install`
- [x] 1.2 Add `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (public) and `SUPABASE_SERVICE_ROLE_KEY` (server-only) to `.env` and `.env.example`

## 2. Supabase clients & auth helper

- [x] 2.1 Create `lib/supabase/server.ts` (`createServerClient` via `@supabase/ssr`) wiring `cookies()` with cookies set `httpOnly`, `Secure`, `SameSite=Lax`
- [x] 2.2 Create `lib/supabase/client.ts` (`createBrowserClient`) using only the public anon key
- [x] 2.3 Create `lib/auth/getCurrentUser.ts` marked `import "server-only"`, returning the authenticated user or null

## 3. Middleware & auth routes

- [x] 3.1 Add `middleware.ts` that refreshes the session and redirects unauthenticated requests to `/login`, with a `matcher` excluding static assets and an allow-list of `/login` and `/auth/callback`
- [x] 3.2 Add a minimal `/login` page/route with email auth (magic link or email+password)
- [x] 3.3 Add `app/auth/callback` route handler that completes sign-in and establishes the session
- [x] 3.4 Add a logout handler that clears the session cookies

## 4. Data model: ownerId + migration

- [x] 4.1 Add required `ownerId String` to `Campaign` in `prisma/schema.prisma` with `@@index([ownerId])`
- [x] 4.2 Generate the migration as nullable → backfill existing rows with a constant seed owner id → set `NOT NULL` + index
- [x] 4.3 Update `prisma/seed.ts` to set `ownerId` on the sample campaign; re-run the seed

## 5. Row-Level Security

- [x] 5.1 Add a SQL migration enabling RLS on Campaign, Session, NPC, Location, Item, Character
- [x] 5.2 Add owner-keyed policies: Campaign on `ownerId = auth.uid()`; child tables via their parent campaign's `ownerId`
- [x] 5.3 Apply the migration and confirm RLS is enabled on all six tables

## 6. Owner-scoped data layer

- [x] 6.1 Create `lib/data/campaigns.ts`: list `where {ownerId}`; get/update/delete `where {id, ownerId}`; treat wrong-owner/absent as not-found
- [x] 6.2 Add NPC data access that first resolves an owned parent campaign, returning not-found otherwise

## 7. Wire auth + ownership into route handlers

- [x] 7.1 Update `app/api/campaigns/route.ts`: require auth (401 if none); `GET` lists only the user's campaigns; `POST` sets `ownerId` from session (never body)
- [x] 7.2 Update `app/api/campaigns/[campaignId]/route.ts`: require auth; `GET`/`PATCH`/`DELETE` return 404 for missing or unowned campaigns
- [x] 7.3 Update `app/api/campaigns/[campaignId]/npcs/route.ts`: require auth; operate only under an owned campaign, else 404 (parent still from path)
- [x] 7.4 Confirm no handler reads `ownerId` from the body and the service-role key is never referenced in client code

## 8. Tests

- [x] 8.1 Anonymous access to campaign/NPC endpoints is rejected (401) or redirected; no data touched
- [x] 8.2 `ownerId` is taken from the session only; an `ownerId` in the body is ignored
- [x] 8.3 Cross-user access (read/update/delete/list-NPCs/create-NPC) returns 404
- [x] 8.4 `getCurrentUser()` returns the user with a session and null without one (mocked)
- [x] 8.5 List returns only the current user's campaigns (owner-scoped data layer, mocked Prisma)
- [x] 8.6 (Optional, local-only) DB-integration test: RLS denies cross-user rows, gated on `DIRECT_URL`

## 9. Verification

- [x] 9.1 Run `npx tsc --noEmit` and fix any type errors (no `any`)
- [x] 9.2 Run the Vitest suite and confirm all tests pass
