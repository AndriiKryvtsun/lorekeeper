## ADDED Requirements

### Requirement: Campaign endpoints require authentication
Every campaign and NPC endpoint SHALL require an authenticated user. A request without a
valid session MUST be rejected (`401`) or redirected to login and MUST NOT read or write
any data.

#### Scenario: Anonymous request is rejected
- **WHEN** an unauthenticated client calls any campaign or NPC endpoint
- **THEN** the request is rejected (401) or redirected to login and no data is read or written

### Requirement: Authorization is enforced server-side with owner from session
The system SHALL enforce authorization server-side in every route handler and server
action. The owning user's id SHALL be taken only from the authenticated session, never
from the request body or query. Any `ownerId` supplied in input MUST be ignored. Access
to a campaign the current user does not own MUST return `404` (not `403`), so existence
is not revealed.

#### Scenario: ownerId in the body is ignored
- **WHEN** a client includes an `ownerId` in a create or update body
- **THEN** the stored/owning id is the session user's id and the supplied value is ignored

#### Scenario: Cross-user access returns 404
- **WHEN** an authenticated user references a campaign owned by another user
- **THEN** the response status is 404 and no data is read or written

## MODIFIED Requirements

### Requirement: List campaigns
The system SHALL expose `GET /api/campaigns` returning only the campaigns owned by the
authenticated user, as JSON.

#### Scenario: Only the user's campaigns are returned
- **WHEN** an authenticated client sends `GET /api/campaigns`
- **THEN** the response status is 200 and the body contains only campaigns whose `ownerId` is the current user

### Requirement: Create campaign with validated input
The system SHALL expose `POST /api/campaigns` that validates the request body with Zod
before persisting. A valid body MUST include a non-empty `title` and a non-empty
`system`; `description` is optional. The created campaign's `ownerId` MUST be the
authenticated user's id, taken from the session and never from the body. Invalid input
MUST be rejected without a database write.

#### Scenario: Valid campaign is created for the current user
- **WHEN** an authenticated client sends `POST /api/campaigns` with a non-empty `title` and `system`
- **THEN** the response status is 201 and the created campaign has `ownerId` equal to the current user

#### Scenario: Invalid campaign is rejected
- **WHEN** a client sends `POST /api/campaigns` with a missing or empty `title`
- **THEN** the response status is 400, the body describes the validation error, and no row is created

### Requirement: Read a single campaign
The system SHALL expose `GET /api/campaigns/{id}` returning the campaign only when it
exists and is owned by the authenticated user; otherwise it MUST return 404.

#### Scenario: Owned campaign is returned
- **WHEN** an authenticated client sends `GET /api/campaigns/{id}` for a campaign they own
- **THEN** the response status is 200 and the body is that campaign

#### Scenario: Missing campaign yields 404
- **WHEN** a client sends `GET /api/campaigns/{id}` for an id that does not exist
- **THEN** the response status is 404

#### Scenario: Another user's campaign yields 404
- **WHEN** an authenticated client sends `GET /api/campaigns/{id}` for a campaign owned by a different user
- **THEN** the response status is 404

### Requirement: Update a campaign with validated input
The system SHALL expose `PATCH /api/campaigns/{id}` that validates a partial body with
Zod and updates the campaign only when it exists and is owned by the authenticated user;
otherwise it MUST return 404.

#### Scenario: Owned campaign is updated
- **WHEN** an authenticated client sends `PATCH /api/campaigns/{id}` for a campaign they own with a valid partial body
- **THEN** the response status is 200 and the body reflects the updated fields

#### Scenario: Invalid update is rejected
- **WHEN** a client sends `PATCH /api/campaigns/{id}` with an invalid field value
- **THEN** the response status is 400 and no update occurs

#### Scenario: Updating another user's campaign yields 404
- **WHEN** an authenticated client sends `PATCH /api/campaigns/{id}` for a campaign owned by a different user
- **THEN** the response status is 404 and no update occurs

### Requirement: Delete a campaign
The system SHALL expose `DELETE /api/campaigns/{id}` that deletes the campaign and its
children only when it exists and is owned by the authenticated user; otherwise it MUST
return 404.

#### Scenario: Owned campaign is deleted
- **WHEN** an authenticated client sends `DELETE /api/campaigns/{id}` for a campaign they own
- **THEN** the response status is 204 and the campaign and its children no longer exist

#### Scenario: Deleting another user's campaign yields 404
- **WHEN** an authenticated client sends `DELETE /api/campaigns/{id}` for a campaign owned by a different user
- **THEN** the response status is 404 and nothing is deleted

### Requirement: List NPCs scoped to a campaign
The system SHALL expose `GET /api/campaigns/{campaignId}/npcs` returning the NPCs of that
campaign only when the campaign is owned by the authenticated user; otherwise it MUST
return 404.

#### Scenario: Only the owned campaign's NPCs are returned
- **WHEN** an authenticated client sends `GET /api/campaigns/{campaignId}/npcs` for a campaign they own
- **THEN** the response status is 200 and the body contains only NPCs whose parent is that campaign

#### Scenario: NPCs of another user's campaign yield 404
- **WHEN** an authenticated client lists NPCs for a campaign owned by a different user
- **THEN** the response status is 404

### Requirement: Create NPC under a campaign with validated input
The system SHALL expose `POST /api/campaigns/{campaignId}/npcs` that validates the body
with Zod and creates the NPC as a child of the campaign only when that campaign is owned
by the authenticated user. A valid body MUST include a non-empty `name`; `role`,
`description`, and `status` follow the data model. The created NPC's parent MUST be the
campaign in the path, not a value taken from the body.

#### Scenario: Valid NPC is created under an owned campaign
- **WHEN** an authenticated client sends `POST /api/campaigns/{campaignId}/npcs` with a non-empty `name` for a campaign they own
- **THEN** the response status is 201 and the created NPC references that campaign

#### Scenario: Invalid NPC is rejected
- **WHEN** a client sends `POST /api/campaigns/{campaignId}/npcs` with a missing `name`
- **THEN** the response status is 400 and no row is created

#### Scenario: NPC under a missing or unowned campaign yields 404
- **WHEN** a client posts an NPC to a `campaignId` that does not exist or is owned by a different user
- **THEN** the response status is 404 and no row is created
