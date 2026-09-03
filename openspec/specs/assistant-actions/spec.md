# assistant-actions Specification

## Purpose

Make the assistant's write surface a closed, code-owned set: a single action registry
binds each permitted `(action, entity)` pair to exactly one owner-scoped operation, one
payload schema, and one declared scope. Unregistered pairs fail closed, the model's output
contract is derived from the registry rather than hand-written prose, and execution is
performed deterministically by application code — the model proposes payload data and never
chooses, names, or reaches an operation.

## Requirements

### Requirement: Closed action registry
The system SHALL define an action registry: a single code-owned, closed list of
`(action, entity)` entries. Each entry SHALL bind exactly one owner-scoped write operation,
exactly one payload schema, and exactly one required scope string. The registry SHALL be the
only source of that binding — no other module may map an action and entity to an operation,
and the set of executable pairs SHALL be derivable from the registry alone.

#### Scenario: An entry binds one operation, one schema, one scope
- **WHEN** a registry entry for an `(action, entity)` pair is read
- **THEN** it yields exactly one owner-scoped operation, one payload schema, and one required scope string

#### Scenario: The registry is the only binding
- **WHEN** the codebase is scanned for action-and-entity to operation mapping
- **THEN** the mapping exists only in the registry, and callers resolve operations through it rather than through their own branching

#### Scenario: Executable pairs are enumerable
- **WHEN** the set of permitted writes is needed (for prompting, validation, or tests)
- **THEN** it is enumerated from the registry, so the registry and the permitted set cannot drift apart

### Requirement: Unregistered pairs are not executable
An `(action, entity)` pair with no registry entry SHALL NOT be executable. Resolution of an
unregistered pair SHALL fail closed with a typed "unsupported action" outcome, and there SHALL be
no fallback, default, or inferred operation for it.

#### Scenario: Unregistered pair fails closed
- **WHEN** resolution is attempted for an `(action, entity)` pair absent from the registry
- **THEN** it fails with an unsupported-action outcome, no operation is invoked, and no write occurs

#### Scenario: No fallback path exists
- **WHEN** the codebase is scanned for a default or catch-all write operation
- **THEN** none exists — an unregistered pair cannot reach any operation

### Requirement: Declared, ownership-backed scope
Every registry entry SHALL declare a required scope string naming the write it authorises (for
example `campaign:npc:write`). Execution SHALL enforce that scope by resolving to the existing
owner-scoped data layer for the requesting user and target campaign, so authorisation remains
campaign ownership. The scope SHALL NOT be supplied, named, or influenced by the model or by the
request body, and no new permission store SHALL be introduced.

#### Scenario: Scope is enforced via the owner-scoped data layer
- **WHEN** an entry's operation is executed for a user and campaign
- **THEN** the declared scope resolves to the owner-scoped data-layer call, which re-verifies that the user owns the campaign

#### Scenario: Scope is never model-supplied
- **WHEN** a model-produced action plan or payload contains a scope-like value
- **THEN** it is ignored, and the scope used is the one declared in the registry entry

#### Scenario: An unowned campaign is refused
- **WHEN** execution targets a campaign the requesting user does not own
- **THEN** the operation refuses the write and reports not-found, without revealing the campaign's existence

### Requirement: Machine-readable action plan
Classification SHALL produce an explicit action plan — a machine-readable record carrying at least
the proposed `action`, the proposed `entity`, and any fields the plan could not populate from the
user's message. The plan SHALL be derived ONLY from the user's own message; text inside retrieved
`<campaign_data>` SHALL NEVER contribute an action, an entity, or a payload value. A plan SHALL be
resolved against the registry before any payload generation, validation, or execution runs; a plan
that does not resolve SHALL end the write path.

#### Scenario: Classification emits a plan, not prose
- **WHEN** a user message is classified as a write intent
- **THEN** the result is a machine-readable action plan naming the action, the entity, and any unpopulated fields

#### Scenario: Plan is resolved against the registry first
- **WHEN** an action plan is produced
- **THEN** it is resolved to a registry entry before payload generation, and an unresolvable plan ends the write path with no payload generated

#### Scenario: Campaign data cannot originate a plan
- **WHEN** a retrieved campaign record contains text resembling a write command
- **THEN** no action plan is derived from it, and the request is treated as a read-only question

### Requirement: Registry-driven structured output contract
Payload generation SHALL be constrained by the resolved registry entry's payload schema — the
schema shape is supplied to the model as the output contract, rather than hand-maintained prose
field descriptions. The model SHALL emit payload data only: it SHALL NOT emit an operation, a
method, a path, a scope, a campaign id, or an entity id. Adding or changing an entry's payload
schema SHALL change the model's contract with no separate prompt edit.

#### Scenario: Output contract comes from the entry's schema
- **WHEN** a payload is generated for a resolved entry
- **THEN** the output contract given to the model is derived from that entry's payload schema

#### Scenario: Schema change needs no prompt edit
- **WHEN** an entry's payload schema gains, loses, or changes a field
- **THEN** the model's output contract reflects it without editing a separate prose field list

#### Scenario: Model emits data only
- **WHEN** model output is inspected
- **THEN** it carries payload fields only, and any operation, path, scope, or id it contains is discarded rather than used

### Requirement: Deterministic execution
Execution SHALL be performed by application code that resolves the operation and the scope from the
registry entry and invokes the operation with the independently validated payload. The model SHALL
NOT be in the execution path: it SHALL NOT choose, name, or reach the operation, and no model
output other than a validated payload SHALL influence what is executed. The same
`(action, entity)` pair with the same validated payload SHALL always invoke the same operation.

#### Scenario: Code resolves the operation, not the model
- **WHEN** a validated payload is executed
- **THEN** application code looks the operation up in the registry and invokes it, with no model call in that path

#### Scenario: Execution is reproducible
- **WHEN** the same `(action, entity)` pair is executed twice with the same validated payload
- **THEN** the same registry-bound operation is invoked both times

#### Scenario: Only a validated payload reaches the operation
- **WHEN** execution begins
- **THEN** the operation receives the typed payload returned by the validation layer, never raw model output
