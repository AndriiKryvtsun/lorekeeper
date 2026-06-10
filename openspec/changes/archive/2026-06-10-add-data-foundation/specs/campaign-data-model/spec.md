## ADDED Requirements

### Requirement: Campaign entity
The system SHALL persist a `Campaign` as the root aggregate. A Campaign MUST have a
unique generated `id`, a non-empty `title`, a `system` label (e.g. "D&D 5e"), an
optional `description`, and a `createdAt` timestamp set at creation time.

#### Scenario: Campaign is created with required fields
- **WHEN** a Campaign is persisted with a `title` and a `system`
- **THEN** the stored row has a unique `id`, the given `title` and `system`, and a `createdAt` timestamp

#### Scenario: Campaign description is optional
- **WHEN** a Campaign is persisted without a `description`
- **THEN** the row is stored with `description` null and no error occurs

### Requirement: Session belongs to a campaign
The system SHALL persist a `Session` with a unique `id`, a `title`, a `date` stored as a
full `DateTime` (so a time of day can be recorded), an optional `summary`, and optional
`notes`. Each Session MUST reference exactly one parent
`Campaign` and MUST be deleted when its parent Campaign is deleted.

#### Scenario: Session is linked to its campaign
- **WHEN** a Session is created referencing an existing Campaign `id`
- **THEN** the Session is retrievable as a child of that Campaign

#### Scenario: Deleting a campaign removes its sessions
- **WHEN** a Campaign with Sessions is deleted
- **THEN** all Sessions referencing that Campaign are also deleted

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
