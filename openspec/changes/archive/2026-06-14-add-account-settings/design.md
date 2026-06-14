## Context

Auth is Supabase via `@supabase/ssr` (server + browser clients; no service-role client yet).
`lib/auth/actions.ts` has `updatePassword` (which already signs out global) but no
change-email or reauthentication, and `app/(app)/account/page.tsx` only hosts the set-password
form. The `auth/confirm` route already verifies any email OTP including `type=email_change` (it
handles `token_hash`/`type` and `code`). Campaign deletes are owner-scoped and cascade to
children. Rules: Prisma-only data access, validate at the boundary, secrets server-only, tests
included, self-scoped (userId from `ctx.user.id`).

## Goals / Non-Goals

**Goals:**
- A self-scoped account page: profile CRUD, safe avatar upload, reauthenticated password/email
  changes, sign-out-other-devices, and reauthenticated irreversible deletion.

**Non-Goals:**
- No admin/other-user management; no social profiles; no public profile pages.
- No new image-processing dependency (EXIF stripped via canvas re-encode).

## Decisions

### 1. `Profile` model + migration + owner-keyed RLS
Add a Prisma `Profile { userId @unique, displayName?, avatarUrl?, bio?, locale?, timezone?,
createdAt, updatedAt }`. Author the migration with an RLS policy `userId = auth.uid()::text`
(matching the existing RLS migration's `auth.uid()` stub pattern). The migration is applied with
the operator's consent (`prisma migrate deploy`), like other DB changes.

### 2. `profileRouter` — userId only from `ctx.user.id`
`getMyProfile` returns the row for `ctx.user.id` (or a null/default shape if none yet);
`updateMyProfile` validates with a shared `profileSchema` (`lib/validation/profile.ts`) and
upserts keyed by `ctx.user.id`. Input has NO `userId` field; even if one is sent it is ignored.
Rationale: self-scoping is structural — there is no code path that accepts a foreign userId.

### 3. Avatar: client re-encode (EXIF strip) + dual validation + RLS folder
The browser validates MIME (raster allow-list: png/jpeg/webp; SVG and non-images rejected) and
size, re-encodes the image via a `<canvas>` (which drops EXIF and normalizes to a raster type),
and uploads with the user's own Supabase session to `avatars/${userId}/avatar.<ext>` — bucket
RLS permits only the user's own folder. The server (`updateMyProfile` / a dedicated mutation)
RE-validates the MIME/size and derives/asserts the path from `ctx.user.id` (never trusts a
client path) before storing `avatarUrl`. Rationale: canvas re-encode strips EXIF with no image
dependency; dual validation + RLS gives defense-in-depth; raster-only + SVG-reject closes the
stored-XSS vector. Alternative considered: server-side `sharp` (rejected — heavy dep; canvas
suffices for EXIF strip).

### 4. Security actions reuse auth
- **Change/set password**: reuse `updatePassword` (already global sign-out). The set-password
  form for magic-link users keeps being hosted here.
- Account deletion is gated behind reauthentication (current password re-verified server-side
  via `signInWithPassword`). (Email change was intentionally dropped from scope.)

### 5. Sign out other devices
A server action calling `supabase.auth.signOut({ scope: "others" })` (revokes other sessions,
keeps the current one). The post-password-change global sign-out remains separate.

### 6. Account deletion via service-role admin client (server only)
Add `lib/supabase/admin.ts` — a `server-only` client built with `SUPABASE_SERVICE_ROLE_KEY`
(`persistSession: false`), used solely for `auth.admin.deleteUser`. The delete mutation: verify
the typed email equals `ctx.user.email` AND reauthentication succeeded; then (a) delete the
user's campaigns via the owner-scoped data layer (cascades to children) and the profile, (b)
call `admin.deleteUser(ctx.user.id)`, (c) write a redacted audit record, (d) sign out.
Rationale: only the admin API can remove an auth user; it must never touch the client.

## Risks / Trade-offs

- **Service-role key exposure** → confined to `lib/supabase/admin.ts` (`server-only`); never
  imported by client code; never logged. A boundary test asserts it isn't referenced outside
  the server/env.
- **Canvas re-encode loses nothing important but changes encoding** → acceptable for avatars;
  server still re-validates the result. Animated GIFs would flatten — allow-list can exclude GIF.
- **Reauthentication for deletion** → the server re-verifies the current password
  (`signInWithPassword`) before deleting; magic-link users set a password first. Fail-closed.
- **Partial deletion failure** → delete app data before the auth user; if the admin delete
  fails, the audit records the failure and the user can retry; data is already owner-scoped.
- **Bucket misconfiguration** → without the per-user-folder RLS policy, uploads could be
  unscoped; documented as a required operator setting and the server still derives the path.

## Manual Supabase settings (operator)

- Create the `avatars` Storage bucket with: a per-user-folder RLS policy (write/update/delete
  only where the first path segment equals `auth.uid()`), a size limit, and a raster-only MIME
  allow-list (no `image/svg+xml`).

## Open Questions

- Allowed raster types: png/jpeg/webp (exclude gif to avoid animation flattening?) — finalize
  during apply.
