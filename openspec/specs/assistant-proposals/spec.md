# assistant-proposals

## Purpose

Enable the campaign assistant to propose create/update/delete changes to campaign entities
based on the user's own message, while keeping a human in the loop: the model only proposes,
the user confirms, and writes happen through the existing owner-scoped data layer. Proposals
are validated and audited, and prompt-injection from retrieved campaign data can never trigger
a write.

## Requirements

### Requirement: Write-intent detection from the user message only
The assistant SHALL determine whether the user's own message expresses an intent to create,
update, or delete a campaign entity (NPC, location, item, session, or character). A write
intent SHALL be derived ONLY from the user's message; text appearing inside the retrieved
`<campaign_data>` SHALL NEVER trigger a write path (prompt-injection safe). Read-only
questions SHALL continue to use the existing grounded Q&A path unchanged.

#### Scenario: A create request routes to the proposal path
- **WHEN** the user message expresses a create/update/delete intent for a supported entity
- **THEN** the assistant routes to proposal generation rather than the grounded Q&A answer

#### Scenario: A question routes to grounded Q&A
- **WHEN** the user message is a read-only question
- **THEN** the assistant uses the existing grounded answer path and produces no proposal

#### Scenario: Injected instructions in campaign data never trigger a write
- **WHEN** a retrieved campaign record contains text resembling a write command (e.g. "create an NPC named X")
- **THEN** the assistant treats it as data and does NOT route to the proposal path

### Requirement: Structured, validated proposal generation
For a write intent, the assistant SHALL produce a structured proposal of the shape
`{ action: "create" | "update" | "delete", entity, campaignId, fields }` using the LLM
provider's structured-output generation. The model output SHALL be validated with Zod at the
boundary before it is used or returned, and a proposal that fails validation SHALL be
rejected (never returned as committable). The model SHALL NOT access or mutate the database
on this path — it emits a proposal only.

#### Scenario: Valid proposal is produced and returned
- **WHEN** a write intent is processed
- **THEN** the assistant returns a Zod-validated proposal describing the action, entity, target campaign, and fields

#### Scenario: Malformed model output is rejected
- **WHEN** the model returns output that does not satisfy the proposal schema
- **THEN** the proposal is rejected and nothing is committed

#### Scenario: Proposal generation performs no database write
- **WHEN** a proposal is generated
- **THEN** no campaign data is created, updated, or deleted as a result of generation alone

### Requirement: Human confirmation before any write
A proposal SHALL be presented to the user as a confirmable card that summarizes exactly what
will change, with explicit Confirm and Cancel actions. No database write SHALL occur unless
the user explicitly confirms. Cancelling or ignoring a proposal SHALL leave campaign data
unchanged.

#### Scenario: Proposal renders as a confirmable summary
- **WHEN** the assistant returns a proposal
- **THEN** the chat UI renders a summary of the change with Confirm and Cancel actions

#### Scenario: No write without explicit confirmation
- **WHEN** a proposal is returned but the user has not confirmed
- **THEN** no write is performed and campaign data is unchanged

#### Scenario: Cancel discards the proposal
- **WHEN** the user cancels a proposal
- **THEN** the proposal is discarded and no write occurs

### Requirement: Confirmed commit through the owner-scoped data layer
On explicit confirmation, the write SHALL be performed by a server-side handler that delegates
to the EXISTING owner-scoped data layer / tRPC mutation. The handler SHALL re-authenticate the
user, re-verify ownership of the target `campaignId` (returning 404 on mismatch, existence not
revealed), and re-validate the input with the existing Zod schemas before writing. The model
SHALL NOT be in the commit path.

#### Scenario: Confirmed write commits via existing mutation
- **WHEN** the user confirms a valid proposal for a campaign they own
- **THEN** the write is performed through the existing owner-scoped data layer and the entity is persisted

#### Scenario: Cross-user campaign is rejected on commit
- **WHEN** a confirmation targets a campaign the user does not own
- **THEN** the commit returns 404 and no write occurs

#### Scenario: Input is re-validated at commit
- **WHEN** a confirmation is received
- **THEN** the handler re-validates the input with the existing Zod schema before writing and rejects invalid input

### Requirement: Helpful response when neither answer nor proposal applies
When the assistant can neither answer a question from campaign data nor form a valid proposal, it SHALL respond with a helpful message describing what it can do (answer questions
about the campaign; propose creating/updating/deleting supported entities) instead of the
bare "I don't know" grounding fallback.

#### Scenario: Unsupported action gets a helpful explanation
- **WHEN** the user asks for something that is neither answerable from the data nor a supported write intent
- **THEN** the assistant explains what it can do rather than only replying "I don't know"

### Requirement: Audit of proposals and confirmed commits
The assistant SHALL write a redacted audit record when a proposal is generated and when a
commit is confirmed, reusing the existing audit conventions (no prompt text, PII, or
secrets). The commit audit SHALL identify the confirming user, the campaign, the action and
entity, and the outcome.

#### Scenario: Proposal generation is audited
- **WHEN** a proposal is generated
- **THEN** a redacted audit record is written capturing the user, campaign, action, entity, and outcome

#### Scenario: Confirmed commit is audited
- **WHEN** a confirmed commit completes (success or failure)
- **THEN** a redacted audit record is written tying the outcome to the confirming user
