## ADDED Requirements

### Requirement: Endpoints are Next.js App Router route handlers
Every CRUD endpoint SHALL be implemented as a Next.js App Router route handler under
`app/api/`, exporting the relevant HTTP method functions. There MUST be no separate
server process. The routes map to files as follows:
- `app/api/campaigns/route.ts` → `GET` (list), `POST` (create)
- `app/api/campaigns/[campaignId]/route.ts` → `GET`, `PATCH`, `DELETE`
- `app/api/campaigns/[campaignId]/npcs/route.ts` → `GET` (list), `POST` (create)

The campaign-id path segment MUST use a single slug name (`[campaignId]`) across these
routes, since Next.js requires one slug name per dynamic path position.

#### Scenario: Endpoints are served by the Next.js app
- **WHEN** the Next.js app is running and a client requests any campaign or NPC endpoint
- **THEN** the request is handled by the corresponding route handler under `app/api/` with no additional server

### Requirement: List campaigns
The system SHALL expose `GET /api/campaigns` returning all campaigns as JSON.

#### Scenario: Campaigns are returned
- **WHEN** a client sends `GET /api/campaigns`
- **THEN** the response status is 200 and the body is a JSON array of campaigns

### Requirement: Create campaign with validated input
The system SHALL expose `POST /api/campaigns` that validates the request body with Zod
before persisting. A valid body MUST include a non-empty `title` and a non-empty
`system`; `description` is optional. Invalid input MUST be rejected without a database
write.

#### Scenario: Valid campaign is created
- **WHEN** a client sends `POST /api/campaigns` with a non-empty `title` and `system`
- **THEN** the response status is 201 and the body is the created campaign including its `id`

#### Scenario: Invalid campaign is rejected
- **WHEN** a client sends `POST /api/campaigns` with a missing or empty `title`
- **THEN** the response status is 400, the body describes the validation error, and no row is created

### Requirement: Read a single campaign
The system SHALL expose `GET /api/campaigns/{id}` returning the campaign, or 404 if it
does not exist.

#### Scenario: Existing campaign is returned
- **WHEN** a client sends `GET /api/campaigns/{id}` for an existing campaign
- **THEN** the response status is 200 and the body is that campaign

#### Scenario: Missing campaign yields 404
- **WHEN** a client sends `GET /api/campaigns/{id}` for an id that does not exist
- **THEN** the response status is 404

### Requirement: Update a campaign with validated input
The system SHALL expose `PATCH /api/campaigns/{id}` that validates a partial body with
Zod and updates the campaign, returning 404 if it does not exist.

#### Scenario: Campaign is updated
- **WHEN** a client sends `PATCH /api/campaigns/{id}` with a valid partial body
- **THEN** the response status is 200 and the body reflects the updated fields

#### Scenario: Invalid update is rejected
- **WHEN** a client sends `PATCH /api/campaigns/{id}` with an invalid field value
- **THEN** the response status is 400 and no update occurs

### Requirement: Delete a campaign
The system SHALL expose `DELETE /api/campaigns/{id}` that deletes the campaign and its
children, returning 404 if it does not exist.

#### Scenario: Campaign is deleted
- **WHEN** a client sends `DELETE /api/campaigns/{id}` for an existing campaign
- **THEN** the response status is 204 and the campaign and its children no longer exist

### Requirement: List NPCs scoped to a campaign
The system SHALL expose `GET /api/campaigns/{campaignId}/npcs` returning only the NPCs
belonging to that campaign.

#### Scenario: Only the campaign's NPCs are returned
- **WHEN** a client sends `GET /api/campaigns/{campaignId}/npcs`
- **THEN** the response status is 200 and the body contains only NPCs whose parent is that campaign

### Requirement: Create NPC under a campaign with validated input
The system SHALL expose `POST /api/campaigns/{campaignId}/npcs` that validates the body
with Zod and creates the NPC as a child of the campaign. A valid body MUST include a
non-empty `name`; `role`, `description`, and `status` follow the data model. The
created NPC's parent MUST be the campaign in the path, not a value taken from the body.

#### Scenario: Valid NPC is created under the campaign
- **WHEN** a client sends `POST /api/campaigns/{campaignId}/npcs` with a non-empty `name`
- **THEN** the response status is 201 and the created NPC references that campaign

#### Scenario: Invalid NPC is rejected
- **WHEN** a client sends `POST /api/campaigns/{campaignId}/npcs` with a missing `name`
- **THEN** the response status is 400 and no row is created

#### Scenario: NPC under a missing campaign yields 404
- **WHEN** a client posts an NPC to a `campaignId` that does not exist
- **THEN** the response status is 404 and no row is created

### Requirement: Untrusted input is treated as data
The system SHALL treat all request input as untrusted data validated at the boundary
with Zod and MUST NOT interpret any field value as an instruction. API keys and other
secrets MUST never be returned in responses.

#### Scenario: Unexpected fields are ignored
- **WHEN** a request body includes fields not defined in the Zod schema
- **THEN** those fields are stripped and do not reach the database
