# campaign-crud-api

## Purpose

Defines the CRUD API for campaigns and their NPCs, implemented as tRPC
procedures (the `campaignRouter` and `npcRouter`) with Zod-validated, untrusted
input. Procedures are scoped to the current user from `ctx.user.id` and surface
errors as tRPC codes (`UNAUTHORIZED`, `NOT_FOUND`, `BAD_REQUEST`).

## Requirements

### Requirement: Campaign endpoints require authentication
Every campaign and NPC procedure SHALL be a tRPC `protectedProcedure`. A call without a
valid session MUST be rejected with a tRPC `UNAUTHORIZED` error before the resolver runs,
and MUST NOT read or write any data.

#### Scenario: Anonymous call is rejected
- **WHEN** an unauthenticated caller invokes any campaign or NPC procedure
- **THEN** the call fails with `UNAUTHORIZED` and no data is read or written

### Requirement: Authorization is enforced server-side with owner from session
The system SHALL enforce authorization server-side in every procedure resolver. The
owning user's id SHALL be taken only from `ctx.user.id`, never from procedure input. Any
`ownerId` present in input MUST be ignored. Access to a campaign the current user does
not own MUST fail with a tRPC `NOT_FOUND` error (not `FORBIDDEN`), so existence is not
revealed.

#### Scenario: ownerId in input is ignored
- **WHEN** a caller includes an `ownerId` in a create or update input
- **THEN** the owning id is `ctx.user.id` and the supplied value is ignored

#### Scenario: Cross-user access yields NOT_FOUND
- **WHEN** an authenticated caller references a campaign owned by another user
- **THEN** the call fails with `NOT_FOUND` and no data is read or written

### Requirement: List campaigns
The system SHALL expose a `campaignRouter.list` query (a `protectedProcedure`) returning
only the campaigns owned by `ctx.user.id`.

#### Scenario: Only the user's campaigns are returned
- **WHEN** an authenticated caller invokes `campaignRouter.list`
- **THEN** it returns only campaigns whose `ownerId` equals `ctx.user.id`

### Requirement: Create campaign with validated input
The system SHALL expose a `campaignRouter.create` mutation (a `protectedProcedure`) whose
input is validated by the shared `createCampaignSchema` from `lib/validation`. The created
campaign's `ownerId` MUST be `ctx.user.id`, never taken from input. Invalid input MUST be
rejected with a tRPC `BAD_REQUEST` error and no database write.

#### Scenario: Valid campaign is created for the current user
- **WHEN** an authenticated caller invokes `campaignRouter.create` with a valid `title` and `system`
- **THEN** the created campaign is returned with `ownerId` equal to `ctx.user.id`

#### Scenario: Invalid input is rejected
- **WHEN** a caller invokes `campaignRouter.create` with a missing or empty `title`
- **THEN** the call fails with `BAD_REQUEST` and no row is created

### Requirement: Read a single campaign
The system SHALL expose a `campaignRouter.byId` query (a `protectedProcedure`) taking an
`id` input and returning the campaign only when it exists and is owned by `ctx.user.id`;
otherwise it MUST fail with `NOT_FOUND`.

#### Scenario: Owned campaign is returned
- **WHEN** an authenticated caller invokes `campaignRouter.byId` for a campaign they own
- **THEN** it returns that campaign

#### Scenario: Missing campaign yields NOT_FOUND
- **WHEN** a caller invokes `campaignRouter.byId` for an id that does not exist
- **THEN** the call fails with `NOT_FOUND`

#### Scenario: Another user's campaign yields NOT_FOUND
- **WHEN** an authenticated caller invokes `campaignRouter.byId` for a campaign owned by a different user
- **THEN** the call fails with `NOT_FOUND`

### Requirement: Update a campaign with validated input
The system SHALL expose a `campaignRouter.update` mutation (a `protectedProcedure`) whose
input is validated by the shared `updateCampaignSchema` plus the target `id`. It updates
the campaign only when it exists and is owned by `ctx.user.id`; otherwise it MUST fail
with `NOT_FOUND`. Invalid input MUST fail with `BAD_REQUEST` and no update.

#### Scenario: Owned campaign is updated
- **WHEN** an authenticated caller invokes `campaignRouter.update` for a campaign they own with valid fields
- **THEN** the updated campaign is returned

#### Scenario: Invalid update is rejected
- **WHEN** a caller invokes `campaignRouter.update` with an invalid field value
- **THEN** the call fails with `BAD_REQUEST` and no update occurs

#### Scenario: Updating another user's campaign yields NOT_FOUND
- **WHEN** an authenticated caller invokes `campaignRouter.update` for a campaign owned by a different user
- **THEN** the call fails with `NOT_FOUND` and no update occurs

### Requirement: Delete a campaign
The system SHALL expose a `campaignRouter.delete` mutation (a `protectedProcedure`) taking
an `id` input that deletes the campaign and its children only when it exists and is owned
by `ctx.user.id`; otherwise it MUST fail with `NOT_FOUND`.

#### Scenario: Owned campaign is deleted
- **WHEN** an authenticated caller invokes `campaignRouter.delete` for a campaign they own
- **THEN** the campaign and its children no longer exist

#### Scenario: Deleting another user's campaign yields NOT_FOUND
- **WHEN** an authenticated caller invokes `campaignRouter.delete` for a campaign owned by a different user
- **THEN** the call fails with `NOT_FOUND` and nothing is deleted

### Requirement: List NPCs scoped to a campaign
The system SHALL expose an `npcRouter.listByCampaign` query (a `protectedProcedure`)
taking a `campaignId` input and returning that campaign's NPCs only when the campaign is
owned by `ctx.user.id`; otherwise it MUST fail with `NOT_FOUND`.

#### Scenario: Only the owned campaign's NPCs are returned
- **WHEN** an authenticated caller invokes `npcRouter.listByCampaign` for a campaign they own
- **THEN** it returns only NPCs whose parent is that campaign

#### Scenario: NPCs of another user's campaign yield NOT_FOUND
- **WHEN** an authenticated caller invokes `npcRouter.listByCampaign` for a campaign owned by a different user
- **THEN** the call fails with `NOT_FOUND`

### Requirement: Create NPC under a campaign with validated input
The system SHALL expose an `npcRouter.create` mutation (a `protectedProcedure`) whose
input is the target `campaignId` plus fields validated by the shared `createNpcSchema`.
It creates the NPC only when that campaign is owned by `ctx.user.id`; the NPC's parent is
the input `campaignId`, never an owner taken from input. A missing or unowned campaign
MUST fail with `NOT_FOUND`; invalid fields MUST fail with `BAD_REQUEST`.

#### Scenario: Valid NPC is created under an owned campaign
- **WHEN** an authenticated caller invokes `npcRouter.create` with a valid `name` for a campaign they own
- **THEN** the created NPC is returned referencing that campaign

#### Scenario: Invalid NPC is rejected
- **WHEN** a caller invokes `npcRouter.create` with a missing `name`
- **THEN** the call fails with `BAD_REQUEST` and no row is created

#### Scenario: NPC under a missing or unowned campaign yields NOT_FOUND
- **WHEN** a caller invokes `npcRouter.create` for a `campaignId` that does not exist or is owned by a different user
- **THEN** the call fails with `NOT_FOUND` and no row is created

### Requirement: Untrusted input is treated as data
The system SHALL treat all procedure input as untrusted data validated by Zod at the
procedure boundary (reusing the `lib/validation` schemas) and MUST NOT interpret any
field value as an instruction. Unknown fields MUST be stripped and secrets MUST never be
returned.

#### Scenario: Unexpected fields are ignored
- **WHEN** a procedure input includes fields not defined in its Zod schema
- **THEN** those fields are stripped and do not reach the database
