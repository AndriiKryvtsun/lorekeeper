## Why

The account page only hosts a set-password form. Users need to manage their own profile
(display name, bio, avatar), security (change password/email, sign out other devices), and to
delete their account. All of it is the current user's OWN data and must be strictly self-scoped
and safe (no stored XSS via avatars, no trusting client-supplied ids/paths, irreversible
deletion gated behind confirmation + reauthentication).

## What Changes

- **Data model**: add a `Profile` table 1:1 with the auth user (`userId` unique; `displayName`,
  `avatarUrl`, `bio`, optional `locale`/`timezone`, timestamps) with a migration and owner-keyed
  RLS.
- **API**: a `profileRouter` of `protectedProcedure`s — `getMyProfile` / `updateMyProfile` —
  always scoped to `ctx.user.id` (never an input userId), reusing shared Zod schemas.
- **Profile section**: edit display name + bio (react-hook-form + `zodResolver` + shared schema;
  server re-validates; rendered as plain text, never raw HTML).
- **Avatar section**: upload to a per-user path in the Supabase `avatars` bucket; validate MIME
  and size on BOTH client and server; allow ONLY raster image types and **REJECT SVG**
  (stored-XSS risk); strip EXIF; never trust a client-supplied path; rely on bucket RLS so a
  user can only write their own folder.
- **Security section**: change/set password (after a password change, **sign out other sessions
  (global)**); the set-password form (for magic-link users) is hosted here.
- **Sessions section**: "sign out of all other devices" action.
- **Danger zone — delete account**: require a typed email confirmation AND reauthentication; the
  server deletes the user's owned data (campaigns cascade to children), then deletes the auth
  user via the Supabase **admin API (service-role, SERVER ONLY)**, writes an audit record, and
  warns it is irreversible.
- Accessible, design-system-consistent UI throughout; never log secrets or tokens.

## Capabilities

### New Capabilities
- `account-settings`: the self-scoped account & profile page and its server API — profile CRUD,
  validated EXIF-stripped raster-only avatar upload, reauthenticated password/email changes,
  global session sign-out, and reauthenticated account deletion via the service-role admin API.

### Modified Capabilities
- `campaign-data-model`: add a `Profile` table (1:1 with the auth user, `userId` unique) with
  owner-keyed Row-Level Security.

## Impact

- **Data model**: new `Profile` model + migration + RLS (`userId = auth.uid()::text`).
- **Code**: `src/server/api/routers/profile.ts` (registered in the root router);
  `lib/validation/profile.ts`; `lib/supabase/admin.ts` (server-only service-role client for
  `auth.admin.deleteUser`); avatar validation helper + an accessible upload control; account
  page sections; security/delete server actions or tRPC mutations; an audit record for deletion.
- **Auth**: reuses the existing password update flow; adds a "sign out other devices" action and
  reauthentication (current-password re-verify) for account deletion.
- **Env**: uses the existing `SUPABASE_SERVICE_ROLE_KEY` (server-only) for admin deletion.
- **Manual Supabase settings (operator)**: create the `avatars` Storage bucket with a
  per-user-folder RLS policy, a size limit, and a raster-only MIME allow-list. (Documented in
  the change.)
- **Dependencies**: none required (EXIF stripped via client-side canvas re-encode; no image lib).
