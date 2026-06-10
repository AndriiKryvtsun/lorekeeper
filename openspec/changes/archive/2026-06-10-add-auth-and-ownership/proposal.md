## Why

The campaign data foundation currently has no notion of users: any caller can read or
write any campaign, and there is no authentication. Before LoreKeeper can be used by
more than one person — or exposed beyond localhost — every campaign must belong to a
user and every request must be authenticated and authorized. This change adds Supabase
Auth and per-user ownership.

## What Changes

- Add Supabase Auth via `@supabase/supabase-js` and `@supabase/ssr`:
  - Server-side and browser Supabase clients wired through cookies with `@supabase/ssr`.
  - Session cookies set `httpOnly`, `Secure`, `SameSite=Lax`.
  - Auth middleware that refreshes the session and protects every app route except the
    public login and auth-callback routes.
  - Email authentication (magic link or email+password) with login, logout, and callback
    handlers.
  - A server-only `getCurrentUser()` helper.
  - The browser uses only the public anon key; the service-role key is server-only and
    never sent to the client.
- **BREAKING** Extend the data model: add a required `ownerId` (the auth user id) to
  `Campaign`, with a migration.
- **BREAKING** Scope EVERY campaign read and write by the current user's id in the data
  layer; a user can never read or write another user's campaign. Cross-user access
  returns 404 (not 403, to avoid leaking existence). `ownerId` is always taken from the
  session, never from the request body.
- Enable Supabase Row-Level Security (RLS) on all tables with owner-keyed policies as
  defense-in-depth behind the app-layer checks.
- Authorization is enforced server-side in every route handler / server action.

## Capabilities

### New Capabilities
- `user-auth`: Authentication and session management via Supabase Auth — browser/server
  clients, secure session cookies, route-protecting middleware, email login/logout/
  callback, the `getCurrentUser()` helper, and server-only handling of the service-role
  key.

### Modified Capabilities
- `campaign-data-model`: `Campaign` gains a required `ownerId`; a migration adds the
  column; Row-Level Security with owner-keyed policies is enabled on all tables.
- `campaign-crud-api`: All campaign and NPC endpoints require an authenticated user and
  are scoped to that user — listing returns only the user's campaigns, `ownerId` comes
  from the session, and cross-user access returns 404.

## Impact

- **Dependencies**: add `@supabase/supabase-js`, `@supabase/ssr`.
- **Schema/migration**: `Campaign.ownerId` column; RLS enable + policies migration.
- **Code**: new `lib/supabase/` (browser + server clients), `lib/auth/` (`getCurrentUser`),
  `middleware.ts`, auth routes (`app/login`, `app/auth/callback`, logout), and an
  owner-scoped data layer used by the existing `app/api/campaigns/**` handlers.
- **Config**: `.env`/`.env.example` gain `NEXT_PUBLIC_SUPABASE_URL`,
  `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and server-only `SUPABASE_SERVICE_ROLE_KEY`.
- **Tests**: anonymous access redirected/rejected; cross-user access → 404; `ownerId`
  sourced only from the session; RLS denies cross-user rows.
- Existing campaign/NPC handlers and tests are updated to require auth and owner scoping.
