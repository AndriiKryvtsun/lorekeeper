## 1. Dependencies & configuration

- [x] 1.1 Add `zod` to dependencies and `vitest` + `tsx` to devDependencies in `package.json`
- [x] 1.2 Add npm scripts: `test` (vitest run), `db:seed`, and a `prisma.seed` entry pointing at `tsx prisma/seed.ts`
- [x] 1.3 Create `.env.example` documenting `DATABASE_URL` (pooled) and `DIRECT_URL` (direct), and confirm `.env` has both
- [x] 1.4 Add `vitest.config.ts` (or equivalent) configured for TypeScript and the project paths; default test run mocks the Prisma client (no DB needed) and DB-integration tests are gated on `DIRECT_URL` being set (skipped otherwise — no CI database)

## 2. Prisma schema & datasource

- [x] 2.1 Configure Prisma 7 connections: `datasource db` keeps only `provider = "postgresql"` (no `url`/`directUrl`); point `prisma.config.ts → datasource.url` at `DIRECT_URL` for Migrate; add `@prisma/adapter-pg` + `pg` for the runtime pooled `DATABASE_URL` adapter
- [x] 2.2 Add `Campaign` model (cuid `id`, `title`, `system`, optional `description`, `createdAt @default(now())`)
- [x] 2.3 Add `Session` model (id, title, `date` DateTime, optional summary, optional notes) with `campaignId` FK and `onDelete: Cascade`
- [x] 2.4 Add `NPC` model (id, name, optional role, optional description, status) with `campaignId` FK and `onDelete: Cascade`
- [x] 2.5 Add `Location` model (id, name, optional description) with `campaignId` FK and `onDelete: Cascade`
- [x] 2.6 Add `Item` model (id, name, optional description, nullable `ownerNpcId`) with `campaignId` FK `Cascade` and `ownerNpc` relation `onDelete: SetNull`
- [x] 2.7 Add `Character` model (id, name, playerName, class, `level` Int, optional notes) with `campaignId` FK and `onDelete: Cascade`
- [x] 2.8 Add reverse relation fields on `Campaign` for all children and run `prisma format`

## 3. Migration & client

- [x] 3.1 Generate the initial migration with `prisma migrate dev` (creating `prisma/migrations/`) and regenerate the client
- [x] 3.2 Verify all six tables and foreign keys exist (Cascade on children, SetNull on `Item.ownerNpcId`)
- [x] 3.3 Create `lib/prisma.ts` exporting a singleton PrismaClient guarded by a `globalThis` cache for dev hot-reload

## 4. Seed

- [x] 4.1 Write `prisma/seed.ts` that idempotently inserts one sample Campaign with at least one Session, NPC, Location, Item (owned by the NPC), and Character
- [x] 4.2 Run `npm run db:seed` and confirm the sample data exists

## 5. Validation schemas

- [x] 5.1 Create `lib/validation/campaign.ts` with `createCampaignSchema` (title, system required; description optional) and `updateCampaignSchema` (partial), stripping unknown fields
- [x] 5.2 Create `lib/validation/npc.ts` with `createNpcSchema` (name required; role/description/status optional) stripping unknown fields

## 6. Campaign route handlers (App Router, no separate server)

- [x] 6.1 Implement `app/api/campaigns/route.ts` as an App Router route handler exporting `GET` (list all) and `POST` (validate, 201 on success, 400 on invalid)
- [x] 6.2 Implement `app/api/campaigns/[campaignId]/route.ts` exporting `GET` (200/404), `PATCH` (validate, 200/400/404), `DELETE` (204/404) — single `[campaignId]` slug shared with the NPCs route
- [x] 6.3 Ensure responses never include secrets and that handlers use `lib/prisma.ts` (no raw SQL)

## 7. NPC route handlers (App Router, parent-scoped)

- [x] 7.1 Implement `app/api/campaigns/[campaignId]/npcs/route.ts` as an App Router route handler whose `GET` returns only that campaign's NPCs
- [x] 7.2 Add `POST` that validates the body, takes parent from the path (not the body), returns 404 if the campaign is missing, 201 on success, 400 on invalid

## 8. Tests

- [x] 8.1 Test `createCampaignSchema`/`updateCampaignSchema`: valid input passes, missing/empty `title` fails, unknown fields stripped
- [x] 8.2 Test `createNpcSchema`: valid input passes, missing `name` fails, unknown fields stripped
- [x] 8.3 Test Campaign handlers with a mocked Prisma client (no DB): create→201, invalid→400, get missing→404, delete→204
- [x] 8.4 Test NPC handlers with a mocked Prisma client: parent-scoped list, create under existing campaign→201, missing campaign→404, invalid→400
- [x] 8.5 (Optional, local-only) Add DB-integration tests that run against `DIRECT_URL` when set and are skipped otherwise — no CI database

## 9. Verification

- [x] 9.1 Run `npx tsc --noEmit` and fix any type errors (no `any`)
- [x] 9.2 Run the Vitest suite and confirm all tests pass
