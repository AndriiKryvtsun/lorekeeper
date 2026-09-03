# assistant-responses Specification

## Purpose

Give the assistant's write path one predictable contract with the client: every outcome —
success, clarification, proposal, validation error, operation error, transport error — is
returned in a single discriminated response envelope. Failures are normalised by deterministic
code into stable machine-readable codes and safe user-facing messages that leak no prompt text,
PII, secrets, or provider detail; ownership failures stay indistinguishable from missing records;
and the chat UI renders each state from the discriminator, accessibly and sanitized.

## Requirements

### Requirement: Single response envelope for the write path
Every outcome of the write path SHALL be returned in one response envelope carrying a discriminated
outcome and, for that outcome, only its own payload. The envelope SHALL cover exactly these
outcomes: `success` (a write completed), `clarification` (a question, with nothing confirmable),
`proposal` (a validated, confirmable payload), `validation_error` (the payload did not satisfy its
registry schema), `operation_error` (the owner-scoped operation refused or failed), and
`transport_error` (the model or a dependency was unreachable, timed out, or was rate-limited).
No write-path outcome SHALL be returned outside the envelope.

#### Scenario: Each outcome is discriminated
- **WHEN** the write path returns any outcome
- **THEN** the response is an envelope whose outcome discriminator is one of the defined values, carrying only that outcome's payload

#### Scenario: No outcome bypasses the envelope
- **WHEN** the write path is exercised across success, clarification, proposal, validation failure, operation failure, and transport failure
- **THEN** every case is returned as an envelope, with no ad-hoc shape for any case

#### Scenario: A clarification carries no confirmable payload
- **WHEN** the envelope's outcome is `clarification`
- **THEN** it carries the question only, and no confirmable payload or confirm action

### Requirement: Error normalisation
Failures SHALL be normalised into the envelope by deterministic code: each failure SHALL map to
exactly one outcome with a stable machine-readable code and a user-facing message. Distinct failure
modes SHALL NOT collapse into one indistinguishable error, and an unrecognised internal failure
SHALL normalise to `transport_error` rather than escaping unhandled or surfacing raw. The
normalised message SHALL NOT contain prompt text, PII, secrets, stack traces, internal identifiers,
or provider error detail; those SHALL go to the redacted server log instead.

#### Scenario: Failure modes stay distinguishable
- **WHEN** a schema violation, a refused operation, and a provider timeout each occur
- **THEN** each yields its own outcome and stable code, distinguishable without parsing message text

#### Scenario: Timeouts and rate limits normalise to transport_error
- **WHEN** the model call times out, is rate-limited, or its provider is unreachable
- **THEN** the envelope reports `transport_error` with a stable code and a retry-oriented message

#### Scenario: An unexpected failure is normalised, not leaked
- **WHEN** an unrecognised internal error is raised in the write path
- **THEN** it is normalised into the envelope and the raw error does not reach the client

#### Scenario: Messages carry no sensitive detail
- **WHEN** any error envelope is inspected
- **THEN** it contains no prompt text, PII, secret, stack trace, internal identifier, or provider error string, while the redacted server log retains the diagnostic detail

### Requirement: Ownership failures remain non-revealing
An outcome caused by a campaign or entity the requesting user does not own SHALL be normalised as
`operation_error` with a not-found code, indistinguishable from a genuinely missing record. The
envelope SHALL NOT reveal that the resource exists, nor who owns it.

#### Scenario: Unowned and missing are indistinguishable
- **WHEN** a write targets a campaign owned by another user versus one that does not exist
- **THEN** both return the same not-found `operation_error` envelope

### Requirement: The chat UI renders every envelope state
The chat UI SHALL render each envelope outcome distinctly and accessibly: `proposal` as the
confirmable card, `clarification` as an answerable question, `success` as a confirmation of what
changed, and each error outcome as its normalised message with a retry affordance where retrying
can help. The UI SHALL derive what it renders from the outcome discriminator, SHALL NOT infer state
by parsing message text, and SHALL NOT render an unknown outcome as if it had succeeded. All
envelope-derived text SHALL render through the existing sanitizing renderer, never as raw HTML.

#### Scenario: Rendering is driven by the discriminator
- **WHEN** the UI receives an envelope
- **THEN** it selects its rendering from the outcome discriminator rather than from message text

#### Scenario: Every state is presented accessibly
- **WHEN** each of the envelope outcomes is received in turn
- **THEN** the UI presents a confirmable card, an answerable question, a success confirmation, or a normalised error with a retry affordance where applicable, each with accessible markup

#### Scenario: An unknown outcome degrades safely
- **WHEN** the UI receives an outcome it does not recognise
- **THEN** it shows a generic error state and offers nothing confirmable, rather than treating it as success

#### Scenario: Envelope text is sanitized
- **WHEN** envelope text contains markdown or HTML-like content
- **THEN** it renders through the sanitizing renderer with raw HTML stripped or escaped
