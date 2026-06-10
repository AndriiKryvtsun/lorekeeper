## Context

LoreKeeper has a scaffolded Next.js App Router + Prisma project but an empty data model
(`prisma/schema.prisma` declares only a `prisma-client` generator outputting to
`app/generated/prisma` and a bare `postgresql` datasource). There is no `lib/`, no Zod,
and no test runner yet. Project conventions (CLAUDE.md) require: strict TypeScript with
no `any`; Prisma as the only data-access layer (no raw SQL); the pooled `DATABASE_URL`
at runtime and `DIRECT_URL` for migrations; Zod validation at every boundary; tests with
every change; and untrusted-input handling. This change builds the persistent domain and
its CRUD surface so later features (including AI) have data to operate on.

## Goals / Non-Goals

**Goals:**
- A Prisma schema modeling Campaign and its five child entities with correct relations
  and referential-integrity rules.
- The first migration that materializes the schema in Postgres.
- A re-runnable seed creating one representative sample campaign.
- Typed, Zod-validated CRUD route handlers for Campaign and for NPC (parent-scoped).
- A test suite covering validation and handler behavior.

**Non-Goals:**
- Any AI/assistant features or vendor SDK usage.
- CRUD for Session, Location, Item, Character (modeled and seeded, but no endpoints yet).
- Authentication/authorization and multi-tenant ownership.
- UI/pages for managing campaigns.
- Pagination, filtering, or sorting beyond a basic list.

## Decisions

- **ID strategy: `cuid()` string IDs.** Stable, URL-safe, non-enumerable, and Prisma's
  common default. Alternative: auto-increment ints — rejected because sequential ids
  leak counts and are guessable in URLs.
- **Cascade rules.** All child entities use `onDelete: Cascade` from `Campaign`, so
  deleting a campaign removes its children in one operation. The `Item.ownerNpc`
  relation uses `onDelete: SetNull` with a nullable `ownerNpcId`, so deleting an NPC
  clears ownership without destroying items. Alternative: `Restrict` — rejected because
  it would force manual cleanup and complicate campaign deletion.
- **`Character.class` column.** `class` is a reserved word in many contexts; the Prisma
  field is `class` mapped to a column via `@map("class")` only if the DB requires it —
  otherwise kept as `class`. Level stored as `Int`.
- **Validation boundary: Zod schemas in `lib/validation/`.** Each route parses
  `request.json()` through a schema with `.strict()`-style stripping so unknown fields
  never reach Prisma. Separate `create` and `update` (partial) schemas per entity.
  Alternative: validating inside handlers ad hoc — rejected for consistency/testability.
- **Prisma client singleton in `lib/prisma.ts`.** Guards against multiple clients during
  Next.js dev hot-reload via a `globalThis` cache. Generator output stays at
  `app/generated/prisma`; the singleton imports from there.
- **Connection config (Prisma 7 model).** Prisma 7.8 removed `url`/`directUrl` from the
  `datasource` block — `schema.prisma` declares only `provider = "postgresql"`. Instead:
  - **Runtime** uses a driver adapter: the `PrismaClient` in `lib/prisma.ts` is
    constructed with `new PrismaPg({ connectionString: env("DATABASE_URL") })` from
    `@prisma/adapter-pg`, so the app connects through the pooled URL.
  - **Migrations** read `prisma.config.ts → datasource.url`, which we point at
    `env("DIRECT_URL")` (the direct, session-mode connection Migrate requires).
  This preserves the intent (pooled at runtime, direct for migrations) using Prisma 7's
  supported mechanism. Adds `@prisma/adapter-pg` and `pg` dependencies. `.env.example`
  documents both URLs. Alternative: Prisma Accelerate (`accelerateUrl`) — rejected as we
  connect directly to Supabase, not through Accelerate.
- **All endpoints are App Router route handlers — no separate server.** Every endpoint
  is a Next.js App Router route handler under `app/api/`: `app/api/campaigns/route.ts`
  (`GET`/`POST`), `app/api/campaigns/[campaignId]/route.ts` (`GET`/`PATCH`/`DELETE`), and
  `app/api/campaigns/[campaignId]/npcs/route.ts` (`GET`/`POST`). The campaign-id segment
  uses one slug name (`[campaignId]`) everywhere, because Next.js forbids two different
  slug names at the same dynamic path position. Each handler exports the
  matching HTTP method function and returns `Response`/`NextResponse`. Alternative: a
  standalone Express/Fastify server — rejected; it duplicates routing the framework
  already provides and contradicts the App-Router-by-default convention.
- **NPC parent scoping.** The NPC create handler takes `campaignId` from the route path,
  never from the body, and returns 404 if the campaign does not exist — preventing
  cross-campaign writes.
- **`Session.date` is `DateTime`.** Stored as a full `DateTime` rather than date-only so
  we can record session start times later without a migration. Alternative: date-only —
  rejected as it would lose time-of-day we expect to want.
- **Test runner: Vitest, DB mocked in unit tests.** Lightweight, TS-native, fast. There
  is no CI Postgres, so unit tests mock the Prisma client (`lib/prisma.ts`) and assert
  validation and handler logic deterministically. DB-integration tests that need a real
  Postgres are opt-in/local — they run only when `DIRECT_URL` points at a developer's
  database and are skipped otherwise. This change adds no CI database requirement.
  Alternative: Jest — rejected for heavier ESM/TS config in a Next 16 project.
- **Seed runner: `tsx`** invoked via Prisma's `prisma.seed` config and an npm script.

## Risks / Trade-offs

- **No CI Postgres** → DB-integration tests cannot run in CI; mitigate by mocking the
  Prisma client in unit tests (the default, always-run path) and marking DB-integration
  tests opt-in/local so they run against `DIRECT_URL` only when a developer database is
  present, and are skipped otherwise. No CI database is introduced by this change.
- **Next 16 preview + Prisma 7 are recent** → API surfaces may shift; mitigate by
  pinning versions already in `package.json` and isolating Prisma access behind
  `lib/prisma.ts`.
- **`SetNull` requires nullable FK** → enforced by making `ownerNpcId` optional in the
  schema; a non-null constraint would break the rule, so it is covered by a spec scenario.
- **Reserved-word field `class`** → if Prisma/Postgres rejects it, fall back to
  `@map("class")`; verified during migration.

## Migration Plan

1. Add `zod`, `vitest`, and `tsx` (dev) to `package.json`.
2. Update `prisma/schema.prisma` (datasource URLs + models).
3. Generate the initial migration with `prisma migrate dev` against `DIRECT_URL`.
4. Run the seed; verify the sample campaign and children exist.
5. Add `lib/prisma.ts`, `lib/validation/`, and the route handlers, then tests.
6. Run `npx tsc --noEmit` and the Vitest suite.
- **Rollback:** the change is additive to an empty model; revert by dropping the new
  migration and removing added files. No production data exists yet.

## Open Questions

- None outstanding. Previously open questions are now resolved in Decisions:
  `Session.date` is a full `DateTime`, and there is no CI Postgres — unit tests mock the
  DB while DB-integration tests are opt-in/local.
