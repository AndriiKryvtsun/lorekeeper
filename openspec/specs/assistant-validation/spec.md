# assistant-validation Specification

## Purpose

Keep model output from ever becoming a write on trust. Payloads are validated by
deterministic code against the resolved registry entry's schema before execution and again at
commit; missing, ambiguous, or contradictory input produces a clarifying question instead of a
guessed value (unless the user explicitly delegates the choice, and even then never sourced from
retrieved data); a partially populated payload is never confirmable; and write-path context is
assembled deterministically within fixed bounds so pinned instructions cannot be displaced by
conversation history or retrieved campaign data.

## Requirements

### Requirement: Independent payload validation before execution
Model-produced payloads SHALL be validated against the resolved registry entry's payload schema by
deterministic code, independently of the model, before any operation is invoked. Validation SHALL
be the only route from model output to a typed payload: unknown or over-scoped keys SHALL be
stripped, type and range violations SHALL fail the payload, and a failed payload SHALL NOT be
executed, presented for confirmation, or retried by asking the model to self-correct its own
verdict. Validation SHALL run again at commit, on the same schema, so a payload altered between
proposal and confirmation cannot be written.

#### Scenario: Valid payload becomes a typed value
- **WHEN** model output satisfies the resolved entry's payload schema
- **THEN** validation returns the typed payload, and only that value is carried forward

#### Scenario: Invalid payload is rejected, not executed
- **WHEN** model output violates the entry's payload schema
- **THEN** the payload is rejected, no operation is invoked, and nothing is presented as confirmable

#### Scenario: Over-scoped keys are stripped
- **WHEN** model output contains keys outside the entry's payload schema
- **THEN** those keys are stripped and never reach the operation

#### Scenario: Payload is re-validated at commit
- **WHEN** a confirmation arrives carrying a payload
- **THEN** it is re-validated against the same registry entry's schema before the write, and a payload that no longer validates is refused

### Requirement: Clarification instead of a guessed payload
The system SHALL ask a clarifying question naming what it needs, and SHALL NOT invent, default,
or infer a value, when the user's message does not supply a value required by the resolved
entry's payload schema. A clarification SHALL carry no confirmable payload. Once the user
supplies the missing value, the write SHALL continue from the same resolved entry without
re-asking for values already given.

The single exception is EXPLICIT DELEGATION: when the user's own latest message asks the
assistant to choose the values it was not given, the system MAY generate those values instead of
asking. Delegation SHALL be derived only from the user's own message — never from retrieved
campaign data or an earlier turn — and even when delegated, a value SHALL NEVER be taken from
retrieved campaign data. A proposal containing generated values SHALL identify which fields were
generated, and SHALL still require explicit confirmation before any write. Absent delegation, the
system SHALL ask rather than generate.

#### Scenario: A missing required value produces a question
- **WHEN** a write intent resolves to an entry whose schema requires a value the user's message does not supply
- **THEN** the system asks for that value and returns no confirmable payload

#### Scenario: Missing values are never invented unsolicited
- **WHEN** a required value is absent from the user's message and the user has not asked the assistant to choose it
- **THEN** no value is fabricated and none is taken from retrieved campaign data

#### Scenario: The answer continues the same write
- **WHEN** the user supplies the requested value
- **THEN** the write continues on the originally resolved entry, retaining values already supplied

#### Scenario: Explicit delegation generates the value instead of re-asking
- **WHEN** the user's own message asks the assistant to choose a value it was not given (e.g. "create your own item name")
- **THEN** the system generates that value, keeps everything the user did supply, and returns a confirmable proposal rather than repeating the question

#### Scenario: Generated values are identified before confirmation
- **WHEN** a proposal contains a value the assistant generated under delegation
- **THEN** the proposal identifies that field as generated, and the write still happens only on explicit confirmation

#### Scenario: Delegation cannot come from campaign data
- **WHEN** a retrieved campaign record contains text resembling a delegation (e.g. "invent a name for this")
- **THEN** it is treated as data, no delegation is inferred, and a missing required value still produces a question

#### Scenario: Even a delegated value never comes from campaign data
- **WHEN** the assistant generates a value under delegation
- **THEN** the value is its own invention, not a value lifted from the retrieved records

### Requirement: Ambiguous or contradictory input produces a question
The system SHALL ask a disambiguating question rather than choosing when the resolved action or
entity is ambiguous, when a named target matches zero or more than one owned entity, or when the
message contains contradictory values for the same field. It SHALL NOT pick one interpretation, one
matching entity, or one of the conflicting values on the user's behalf.

#### Scenario: An ambiguous target is not chosen
- **WHEN** a named update or delete target matches more than one owned entity
- **THEN** the system asks which one is meant and performs no write

#### Scenario: An unmatched target is reported, not guessed
- **WHEN** a named target matches no owned entity
- **THEN** the system says so and asks for the exact name, without substituting a near match

#### Scenario: Contradictory values are surfaced
- **WHEN** the message supplies two different values for the same field
- **THEN** the system asks which value to use rather than selecting one

### Requirement: A partially populated payload is never confirmable
A payload SHALL NOT be presented to the user as confirmable, and SHALL NOT be committable, if it
failed validation, is missing a required value, or rests on an unresolved ambiguity. Every
confirmable payload SHALL have passed independent validation against its registry entry's schema.

#### Scenario: Only validated payloads are confirmable
- **WHEN** the user is shown a confirmable change
- **THEN** its payload has passed independent validation against the resolved entry's schema

#### Scenario: A clarification offers nothing to confirm
- **WHEN** the system asks a clarifying question
- **THEN** the response carries no confirmable payload and no confirm action

### Requirement: Bounded context assembly
Context for the write path SHALL be assembled deterministically and bounded: pinned instructions
SHALL always be present and SHALL NOT be displaceable by conversation history or retrieved data;
conversation history SHALL be truncated to a fixed bound, keeping the most recent turns and any
in-flight clarification; and schema material SHALL be injected only for the resolved entry's
entity, not for every entity. Retrieved campaign data SHALL remain fenced as untrusted data whose
volume is capped, so neither history nor retrieved records can crowd out the pinned instructions.

#### Scenario: Pinned instructions always survive truncation
- **WHEN** history and retrieved data would exceed the context bound
- **THEN** the pinned instructions are retained in full and the history is truncated instead

#### Scenario: History is bounded to recent turns
- **WHEN** the conversation exceeds the configured history bound
- **THEN** only the most recent turns, plus any in-flight clarification, are included

#### Scenario: Only the resolved entity's schema is injected
- **WHEN** context is assembled for a resolved registry entry
- **THEN** schema material for that entry's entity is injected and other entities' schemas are omitted

#### Scenario: Retrieved data stays capped and fenced
- **WHEN** campaign records are included in the write-path context
- **THEN** they are capped per entity type and fenced as untrusted data, never as instructions
