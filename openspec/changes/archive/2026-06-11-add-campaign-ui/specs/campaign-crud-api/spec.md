## ADDED Requirements

### Requirement: Child entity procedures are owner-scoped via their campaign
Every Session, Location, Item, and Character procedure SHALL be a `protectedProcedure`
scoped to `ctx.user.id` through the parent campaign. The parent `campaignId` SHALL come
from procedure input; ownership is verified by resolving a campaign owned by the current
user. A missing or unowned parent campaign — or a target row not under an owned campaign —
MUST fail with a tRPC `NOT_FOUND` error. No `ownerId` is read from input.

#### Scenario: Anonymous caller is rejected
- **WHEN** an unauthenticated caller invokes any child-entity procedure
- **THEN** the call fails with `UNAUTHORIZED` and no data is read or written

#### Scenario: Cross-user child access yields NOT_FOUND
- **WHEN** an authenticated caller targets a child row under a campaign owned by another user
- **THEN** the call fails with `NOT_FOUND` and no data is read or written

### Requirement: Complete NPC CRUD
The system SHALL expose `npc.update` and `npc.delete` mutations (`protectedProcedure`s),
completing NPC CRUD alongside the existing `npc.listByCampaign` and `npc.create`. Both
operate only when the NPC belongs to a campaign owned by `ctx.user.id`; otherwise they
fail with `NOT_FOUND`. `update` validates input with the shared NPC update schema.

#### Scenario: Owned NPC is updated
- **WHEN** an authenticated caller invokes `npc.update` for an NPC under a campaign they own with valid fields
- **THEN** the updated NPC is returned

#### Scenario: Owned NPC is deleted
- **WHEN** an authenticated caller invokes `npc.delete` for an NPC under a campaign they own
- **THEN** the NPC no longer exists

#### Scenario: Updating an unowned NPC yields NOT_FOUND
- **WHEN** an authenticated caller invokes `npc.update`/`npc.delete` for an NPC under a campaign owned by a different user
- **THEN** the call fails with `NOT_FOUND` and nothing changes

### Requirement: Session CRUD
The system SHALL expose a `sessionRouter` with `listByCampaign`, `create`, `update`, and
`delete` (`protectedProcedure`s). Inputs are validated by shared Zod schemas in
`lib/validation`; a Session belongs to its parent campaign (from input `campaignId`).
Cross-user or missing targets fail with `NOT_FOUND`.

#### Scenario: Sessions of an owned campaign are listed
- **WHEN** an authenticated caller invokes `session.listByCampaign` for a campaign they own
- **THEN** it returns only that campaign's sessions

#### Scenario: Session is created/updated/deleted under an owned campaign
- **WHEN** an authenticated caller creates, updates, or deletes a session under a campaign they own with valid input
- **THEN** the operation succeeds and is scoped to that campaign

#### Scenario: Invalid session input is rejected
- **WHEN** a caller submits invalid session input (e.g. missing title or invalid date)
- **THEN** the call fails with `BAD_REQUEST` and nothing is written

### Requirement: Location CRUD
The system SHALL expose a `locationRouter` with `listByCampaign`, `create`, `update`, and
`delete` (`protectedProcedure`s), validated by shared Zod schemas and owner-scoped via the
parent campaign. Cross-user or missing targets fail with `NOT_FOUND`; invalid input fails
with `BAD_REQUEST`.

#### Scenario: Locations of an owned campaign are listed
- **WHEN** an authenticated caller invokes `location.listByCampaign` for a campaign they own
- **THEN** it returns only that campaign's locations

#### Scenario: Location create/update/delete is owner-scoped
- **WHEN** an authenticated caller mutates a location under a campaign they own with valid input
- **THEN** the operation succeeds; for an unowned/missing campaign it fails with `NOT_FOUND`

### Requirement: Item CRUD
The system SHALL expose an `itemRouter` with `listByCampaign`, `create`, `update`, and
`delete` (`protectedProcedure`s), validated by shared Zod schemas and owner-scoped via the
parent campaign. When `ownerNpcId` is provided it MUST reference an NPC within the same
campaign; otherwise it is null. Cross-user or missing targets fail with `NOT_FOUND`;
invalid input fails with `BAD_REQUEST`.

#### Scenario: Items of an owned campaign are listed
- **WHEN** an authenticated caller invokes `item.listByCampaign` for a campaign they own
- **THEN** it returns only that campaign's items

#### Scenario: Item create/update/delete is owner-scoped
- **WHEN** an authenticated caller mutates an item under a campaign they own with valid input
- **THEN** the operation succeeds; for an unowned/missing campaign it fails with `NOT_FOUND`

#### Scenario: Item owner NPC must be in the same campaign
- **WHEN** a caller sets `ownerNpcId` to an NPC that is not in the item's campaign
- **THEN** the call fails (the owner reference is rejected) and the item is not linked cross-campaign

### Requirement: Character CRUD
The system SHALL expose a `characterRouter` with `listByCampaign`, `create`, `update`, and
`delete` (`protectedProcedure`s), validated by shared Zod schemas and owner-scoped via the
parent campaign. Cross-user or missing targets fail with `NOT_FOUND`; invalid input fails
with `BAD_REQUEST`.

#### Scenario: Characters of an owned campaign are listed
- **WHEN** an authenticated caller invokes `character.listByCampaign` for a campaign they own
- **THEN** it returns only that campaign's characters

#### Scenario: Character create/update/delete is owner-scoped
- **WHEN** an authenticated caller mutates a character under a campaign they own with valid input
- **THEN** the operation succeeds; for an unowned/missing campaign it fails with `NOT_FOUND`
