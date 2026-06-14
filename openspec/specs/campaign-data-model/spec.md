# campaign-data-model

## Purpose

Defines the persistent data model for campaigns and their child entities
(Sessions, NPCs, Locations, Items, Characters), along with Prisma migration,
datasource configuration, and a development seed routine.

## Requirements

### Requirement: Campaign entity
The system SHALL persist a `Campaign` as the root aggregate. A Campaign MUST have a
unique generated `id`, a non-empty `title`, a `system` label (e.g. "D&D 5e"), an
optional `description`, a `createdAt` timestamp set at creation time, and a required
`ownerId` holding the authenticated user's id (the Supabase auth user id). `ownerId`
MUST be indexed and is always set from the session, never from request input.

#### Scenario: Campaign is created with required fields
- **WHEN** a Campaign is persisted with a `title`, a `system`, and an `ownerId`
- **THEN** the stored row has a unique `id`, the given `title`, `system`, and `ownerId`, and a `createdAt` timestamp

#### Scenario: Campaign description is optional
- **WHEN** a Campaign is persisted without a `description`
- **THEN** the row is stored with `description` null and no error occurs

#### Scenario: Campaign records its owner
- **WHEN** a Campaign is created on behalf of an authenticated user
- **THEN** its `ownerId` equals that user's auth id

### Requirement: Session belongs to a campaign
The system SHALL persist a `Session` with a unique `id`, a `title`, a `date` stored as a
full `DateTime` (so a time of day can be recorded), an optional user-authored `summary`, and
optional `notes`. The Session SHALL additionally carry optional AI-summary fields — the
generated summary text, the model id, the provider, a generation timestamp, and a hash of the
summarized source content (for idempotency) — distinct from the user-authored `summary`. Each
Session MUST reference exactly one parent `Campaign` and MUST be deleted when its parent
Campaign is deleted.

#### Scenario: Session is linked to its campaign
- **WHEN** a Session is created referencing an existing Campaign `id`
- **THEN** the Session is retrievable as a child of that Campaign

#### Scenario: Deleting a campaign removes its sessions
- **WHEN** a Campaign with Sessions is deleted
- **THEN** all Sessions referencing that Campaign are also deleted

#### Scenario: AI-summary fields are distinct from the user summary
- **WHEN** an AI summary is stored on a Session
- **THEN** it is written to the AI-summary fields (summary text, model id, provider, timestamp, source hash) and does NOT overwrite the user-authored `summary`

### Requirement: NPC belongs to a campaign
The system SHALL persist an `NPC` with a unique `id`, a `name`, an optional `role`, an
optional `description`, and a `status`. Each NPC MUST reference exactly one parent
`Campaign` and MUST be deleted when its parent Campaign is deleted.

#### Scenario: NPC is linked to its campaign
- **WHEN** an NPC is created referencing an existing Campaign `id`
- **THEN** the NPC is retrievable as a child of that Campaign

#### Scenario: Deleting a campaign removes its NPCs
- **WHEN** a Campaign with NPCs is deleted
- **THEN** all NPCs referencing that Campaign are also deleted

### Requirement: Location belongs to a campaign
The system SHALL persist a `Location` with a unique `id`, a `name`, and an optional
`description`. Each Location MUST reference exactly one parent `Campaign` and MUST be
deleted when its parent Campaign is deleted.

#### Scenario: Location is linked to its campaign
- **WHEN** a Location is created referencing an existing Campaign `id`
- **THEN** the Location is retrievable as a child of that Campaign

### Requirement: Item belongs to a campaign and may have an owning NPC
The system SHALL persist an `Item` with a unique `id`, a `name`, an optional
`description`, and a nullable `ownerNpcId`. Each Item MUST reference exactly one parent
`Campaign`. When `ownerNpcId` is set, it MUST reference an `NPC`; when that NPC is
deleted, the Item's `ownerNpcId` SHALL be set to null rather than deleting the Item.

#### Scenario: Item created without an owner
- **WHEN** an Item is created with `ownerNpcId` omitted
- **THEN** the Item is stored with `ownerNpcId` null

#### Scenario: Item owner is cleared when the NPC is deleted
- **WHEN** an NPC that owns an Item is deleted
- **THEN** the Item remains and its `ownerNpcId` becomes null

#### Scenario: Deleting a campaign removes its items
- **WHEN** a Campaign with Items is deleted
- **THEN** all Items referencing that Campaign are also deleted

### Requirement: Character belongs to a campaign
The system SHALL persist a `Character` (a player character) with a unique `id`, a
`name`, a `playerName`, a `class`, an integer `level`, and optional `notes`. Each
Character MUST reference exactly one parent `Campaign` and MUST be deleted when its
parent Campaign is deleted.

#### Scenario: Character is linked to its campaign
- **WHEN** a Character is created referencing an existing Campaign `id`
- **THEN** the Character is retrievable as a child of that Campaign

### Requirement: Database migration and datasource configuration
The system SHALL create the schema through a Prisma migration using the `postgresql`
provider. Prisma MUST connect via the pooled `DATABASE_URL` at runtime and the direct
`DIRECT_URL` for migrations. Under Prisma 7 this is realized with a driver adapter at
runtime (the pooled `DATABASE_URL`) and `prisma.config.ts → datasource.url` set to the
direct `DIRECT_URL` for Migrate; connection URLs are not declared in `schema.prisma`.

#### Scenario: Initial migration creates all tables
- **WHEN** the initial migration is applied to an empty database
- **THEN** tables for Campaign, Session, NPC, Location, Item, and Character exist with the defined columns and foreign keys

#### Scenario: Runtime connects through the pooled URL
- **WHEN** the application instantiates its Prisma client
- **THEN** the client connects using a driver adapter configured with the pooled `DATABASE_URL`

### Requirement: Seed sample campaign
The system SHALL provide a seed routine that inserts one sample Campaign with at least
one Session, NPC, Location, Item, and Character, idempotently re-runnable in a
development database.

#### Scenario: Seed populates a sample campaign
- **WHEN** the seed routine runs against a migrated database
- **THEN** one sample Campaign exists with at least one of each child entity

### Requirement: Ownership migration
The system SHALL add the `Campaign.ownerId` column via a Prisma migration. The migration
MUST account for existing rows (which predate ownership) so the column can become
non-null without orphaning data.

#### Scenario: Migration adds the ownerId column
- **WHEN** the ownership migration is applied
- **THEN** the `Campaign` table has an indexed `ownerId` column and existing rows have a defined ownership value

### Requirement: Row-Level Security on all tables
The system SHALL enable Postgres Row-Level Security on the `Campaign`, `Session`, `NPC`,
`Location`, `Item`, and `Character` tables with owner-keyed policies, as
defense-in-depth behind the application-layer authorization. A policy MUST restrict each
row to the campaign owner: directly via `Campaign.ownerId` and, for child tables, via
their parent campaign's `ownerId`.

#### Scenario: RLS denies cross-user rows
- **WHEN** a query runs under one user's identity against rows owned by a different user
- **THEN** Row-Level Security returns no rows for those other-user records

#### Scenario: RLS is enabled on every table
- **WHEN** the policies migration is applied
- **THEN** RLS is enabled on Campaign, Session, NPC, Location, Item, and Character with owner-keyed policies

### Requirement: Session summary job queue
The system SHALL persist a `SessionSummaryJob` representing queued summarization work, with at
most one job per session (a unique `sessionId`), a status, an attempt count, the source-content
hash to summarize, and timestamps. A job MUST reference exactly one `Session` and MUST be
deleted when its Session is deleted. The table SHALL be protected by Row-Level Security,
scoped through the session's campaign owner like the other tables.

#### Scenario: One job per session
- **WHEN** a session is enqueued for summarization more than once
- **THEN** a single job row exists for that session (unique on `sessionId`)

#### Scenario: Job is removed with its session
- **WHEN** a Session is deleted
- **THEN** its `SessionSummaryJob` is also deleted

#### Scenario: RLS protects the job table
- **WHEN** the job table is queried under the authenticated role
- **THEN** access is restricted via the session's campaign owner, consistent with the other tables

### Requirement: User profile is 1:1 with the auth user
The system SHALL persist a `Profile` with a unique `userId` (the Supabase auth user id, 1:1),
an optional `displayName`, optional `avatarUrl`, optional `bio`, optional `locale` and
`timezone`, and created/updated timestamps. The table SHALL be protected by Row-Level Security
keyed on the owner (`userId = auth.uid()`), consistent with the other tables.

#### Scenario: One profile per user
- **WHEN** a profile is created for a user
- **THEN** at most one `Profile` row exists for that `userId` (unique)

#### Scenario: RLS restricts a profile to its owner
- **WHEN** the `Profile` table is queried under the authenticated role
- **THEN** a user can read/write only their own profile row (`userId = auth.uid()`)
