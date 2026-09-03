## MODIFIED Requirements

### Requirement: Write-intent detection from the user message only
The assistant SHALL determine whether the user's own message expresses an intent to create,
update, or delete a campaign entity (NPC, location, item, session, or character), and SHALL express
that determination as a machine-readable action plan that MUST resolve to an action-registry entry
before the write path continues. A write intent SHALL be derived ONLY from the user's message; text
appearing inside the retrieved `<campaign_data>` SHALL NEVER trigger a write path
(prompt-injection safe). Read-only questions SHALL continue to use the existing grounded Q&A path
unchanged.

#### Scenario: A create request routes to the proposal path
- **WHEN** the user message expresses a create/update/delete intent for a supported entity
- **THEN** the assistant produces an action plan that resolves to a registry entry and routes to proposal generation rather than the grounded Q&A answer

#### Scenario: A question routes to grounded Q&A
- **WHEN** the user message is a read-only question
- **THEN** the assistant uses the existing grounded answer path and produces no action plan and no proposal

#### Scenario: An unsupported action ends the write path
- **WHEN** the action plan names an `(action, entity)` pair with no registry entry
- **THEN** the write path ends with an unsupported-action outcome and no proposal is generated

#### Scenario: Injected instructions in campaign data never trigger a write
- **WHEN** a retrieved campaign record contains text resembling a write command (e.g. "create an NPC named X")
- **THEN** the assistant treats it as data and does NOT route to the proposal path

### Requirement: Structured, validated proposal generation
For a resolved write intent, the assistant SHALL produce a structured proposal of the shape
`{ action: "create" | "update" | "delete", entity, campaignId, fields }`, where the output contract
given to the model is derived from the resolved registry entry's payload schema and the model
supplies `fields` only. The model output SHALL be validated against that same schema,
independently of the model, before it is used or returned, and a proposal that fails validation
SHALL be rejected (never returned as committable). The model SHALL NOT access or mutate the
database on this path, and SHALL NOT supply the action, entity, campaign id, entity id, operation,
or scope — it emits payload data only.

#### Scenario: Valid proposal is produced and returned
- **WHEN** a resolved write intent is processed
- **THEN** the assistant returns a validated proposal describing the action, entity, target campaign, and fields, with the action and entity taken from the action plan rather than from model output

#### Scenario: Malformed model output is rejected
- **WHEN** the model returns output that does not satisfy the registry entry's payload schema
- **THEN** the proposal is rejected and nothing is committed

#### Scenario: Proposal generation performs no database write
- **WHEN** a proposal is generated
- **THEN** no campaign data is created, updated, or deleted as a result of generation alone

### Requirement: Human confirmation before any write
A validated proposal SHALL be presented to the user as a confirmable card that summarizes exactly
what will change, with explicit Confirm and Cancel actions, returned as the `proposal` outcome of
the write-path response envelope. No database write SHALL occur unless the user explicitly
confirms. Cancelling or ignoring a proposal SHALL leave campaign data unchanged.

#### Scenario: Proposal renders as a confirmable summary
- **WHEN** the assistant returns a validated proposal
- **THEN** the envelope reports the `proposal` outcome and the chat UI renders a summary of the change with Confirm and Cancel actions

#### Scenario: No write without explicit confirmation
- **WHEN** a proposal is returned but the user has not confirmed
- **THEN** no write is performed and campaign data is unchanged

#### Scenario: Cancel discards the proposal
- **WHEN** the user cancels a proposal
- **THEN** the proposal is discarded and no write occurs

### Requirement: Confirmed commit through the owner-scoped data layer
On explicit confirmation, the write SHALL be performed by a server-side handler that resolves the
operation and the required scope from the action registry and delegates to the EXISTING
owner-scoped data layer / tRPC mutation bound to that entry. The handler SHALL re-authenticate the
user, re-verify ownership of the target `campaignId` (returning not-found on mismatch, existence
not revealed), and re-validate the payload against the registry entry's schema before writing. The
model SHALL NOT be in the commit path, and the handler SHALL NOT accept an operation, path, or
scope from the request.

#### Scenario: Confirmed write commits via the registry-bound mutation
- **WHEN** the user confirms a valid proposal for a campaign they own
- **THEN** the handler resolves the operation from the registry, performs the write through the existing owner-scoped data layer, and the entity is persisted

#### Scenario: Cross-user campaign is rejected on commit
- **WHEN** a confirmation targets a campaign the user does not own
- **THEN** the commit returns not-found and no write occurs

#### Scenario: Input is re-validated at commit
- **WHEN** a confirmation is received
- **THEN** the handler re-validates the payload against the registry entry's schema before writing and rejects invalid input

#### Scenario: A request-supplied operation or scope is ignored
- **WHEN** a confirmation carries an operation, path, or scope value
- **THEN** it is ignored and the registry-declared operation and scope are used

## REMOVED Requirements

### Requirement: Helpful response when neither answer nor proposal applies
**Reason**: Superseded by the clarification loop in `assistant-validation` and the response
envelope in `assistant-responses`. A single "here's what I can do" fallback conflated three
distinct cases — an unsupported action, a missing required value, and an ambiguous target — and
returned the same prose for each, which the clarification loop and the discriminated envelope now
handle separately and testably.

**Migration**: An unsupported `(action, entity)` pair now returns the envelope's unsupported-action
`validation_error`, whose message states what the assistant can do. A missing required value or an
ambiguous target now returns the `clarification` outcome, naming what is needed rather than
describing the assistant's capabilities. No stored data or client contract changes beyond rendering
the envelope.
