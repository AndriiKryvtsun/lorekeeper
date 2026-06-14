## 1. Data model & migration

- [x] 1.1 Add a `Profile` model to `prisma/schema.prisma`: `userId String @unique`, `displayName String?`, `avatarUrl String?`, `bio String?`, `locale String?`, `timezone String?`, `createdAt`/`updatedAt`
- [x] 1.2 Regenerate the Prisma client; author the migration with an owner-keyed RLS policy (`userId = auth.uid()::text`, matching the existing RLS stub pattern)

## 2. Validation & API

- [x] 2.1 Add `lib/validation/profile.ts`: a shared `updateProfileSchema` (trimmed/clamped `displayName`, `bio`; optional `locale`/`timezone`) — NO `userId` field
- [x] 2.2 Add `lib/data/profile.ts` (owner-scoped): `getProfile(userId)` and `upsertProfile(userId, data)` via Prisma
- [x] 2.3 Add `src/server/api/routers/profile.ts` with `getMyProfile` / `updateMyProfile` (`protectedProcedure`, `userId` from `ctx.user.id` only); register it in the root router

## 3. Profile section UI

- [x] 3.1 Add a profile form (react-hook-form + `zodResolver(updateProfileSchema)`) for display name + bio; labelled inputs with associated error text; success/error toasts; render stored text as plain text (never raw HTML)

## 4. Avatar upload

- [x] 4.1 Add an avatar validation helper (raster allow-list png/jpeg/webp; REJECT SVG and non-images; max size) used on client AND server
- [x] 4.2 Client upload control: validate, re-encode via `<canvas>` to strip EXIF, upload with the user's session to `avatars/${userId}/...` (accessible file input, states, toasts)
- [x] 4.3 Server: re-validate MIME/size, derive the path from `ctx.user.id` (never trust client path), and store `avatarUrl`

## 5. Security section

- [x] 5.1 Keep the post-change global sign-out on password change; host the set-password form (magic-link users) here
- [x] 5.3 Add a "sign out of all other devices" action (`signOut({ scope: "others" })`)

## 6. Danger zone — delete account

- [x] 6.1 Add `lib/supabase/admin.ts`: a `server-only` service-role client (`SUPABASE_SERVICE_ROLE_KEY`, `persistSession: false`) used only for `auth.admin.deleteUser`
- [x] 6.2 Add a `deleteAccount` server mutation: require typed email == `ctx.user.email` AND reauthentication; delete owned campaigns (cascade) + profile, then `admin.deleteUser(ctx.user.id)`, write a redacted audit record, and sign out
- [x] 6.3 Accessible confirm dialog with typed-email confirmation and an irreversible-action warning; toasts

## 7. Page assembly & docs

- [x] 7.1 Compose the account page from design-system primitives with all sections (Profile, Avatar, Security, Sessions, Danger zone); loading/empty/error states; keyboard + screen-reader support
- [x] 7.2 Document the manual Supabase settings (create `avatars` bucket + per-user-folder RLS + size limit + raster-only MIME allow-list; enable Secure email change + reauthentication)

## 8. Tests

- [x] 8.1 Profile API: anonymous rejected; `getMyProfile`/`updateMyProfile` operate on `ctx.user.id` and ignore any injected `userId`; update re-validates with the shared schema
- [x] 8.2 Avatar validation: rejects SVG, non-image, and oversized files (client+server helper)
- [x] 8.3 Delete account: refused without matching typed email or without reauth; on success deletes owned data + profile, calls `admin.deleteUser`, writes audit; anonymous rejected
- [x] 8.4 Password change signs out other sessions (global)
- [x] 8.5 Boundary: `SUPABASE_SERVICE_ROLE_KEY` / the admin client are referenced only server-side (not in client code)

## 9. Verification

- [x] 9.1 Run `npx tsc --noEmit` and fix any type errors (no `any`)
- [x] 9.2 Run the Vitest suite (node + jsdom) and confirm all tests pass
- [x] 9.3 Confirm `next build` succeeds; secrets stay server-only; profile/account procedures are self-scoped; no secret/token logging
