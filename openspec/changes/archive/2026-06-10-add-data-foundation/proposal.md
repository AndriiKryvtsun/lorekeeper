## Why

LoreKeeper currently has only a scaffolded Next.js + Prisma baseline with an empty
data model, so nothing can be stored or served yet. Before any campaign-assistant or
AI features can exist, we need a persistent domain model and the typed CRUD surface to
read and write it. This change establishes that foundation.

## What Changes

- Define the core campaign domain in Prisma: `Campaign` and its child entities
  `Session`, `NPC`, `Location`, `Item`, and `Character`, with the relations described
  below.
- Add the first Prisma migration that creates these tables in Postgres.
- Configure the datasource to use the pooled `DATABASE_URL` at runtime and the direct
  `DIRECT_URL` for migrations, and add a shared Prisma client singleton under `lib/`.
- Add a seed script that creates one sample campaign with representative child rows.
- Implement typed, Zod-validated CRUD route handlers (App Router) for `Campaign` and
  for one child entity, `NPC`, scoped to its parent campaign.
- Add Zod schemas at the API boundary and a test suite covering validation and handler
  behavior.
- No AI features are included in this change.

### Relations
- `Campaign` 1:N `Session`
- `Campaign` 1:N `NPC`
- `Campaign` 1:N `Location`
- `Campaign` 1:N `Item` (each `Item` optionally references an owning `NPC` via nullable `ownerNpcId`)
- `Campaign` 1:N `Character`

## Capabilities

### New Capabilities
- `campaign-data-model`: The persistent domain model — Campaign and its child entities,
  their fields, relations, and integrity rules — plus database migration and seeding.
- `campaign-crud-api`: Typed, validated HTTP CRUD endpoints for managing campaigns and
  their NPCs, including input validation and parent-scoping rules.

### Modified Capabilities
<!-- None. No existing specs in openspec/specs/; this is the first capability set. -->

## Impact

- **Schema**: `prisma/schema.prisma` (new models, datasource `url`/`directUrl`).
- **Migrations**: new `prisma/migrations/` directory with the initial migration.
- **Seed**: new `prisma/seed.ts` and a `prisma.seed` / npm script entry.
- **Code**: new `lib/prisma.ts` (client singleton), `lib/validation/` (Zod schemas),
  and `app/api/campaigns/**` route handlers.
- **Dependencies**: add `zod`, a test runner (`vitest`), and `tsx`/`ts-node` for the
  seed script.
- **Config**: `.env` requires `DATABASE_URL` and `DIRECT_URL`; add a `.env.example`.
- No client-facing UI changes and no AI/vendor SDK code.
