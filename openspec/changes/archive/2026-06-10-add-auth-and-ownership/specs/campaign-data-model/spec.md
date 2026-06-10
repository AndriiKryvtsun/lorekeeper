## MODIFIED Requirements

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

## ADDED Requirements

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
