## ADDED Requirements

### Requirement: Node route handler for the assistant
The assistant SHALL be served by a route handler at `app/api/assistant` declaring
`export const runtime = "nodejs"` (the Prisma pg adapter is not Edge-safe) and a
`maxDuration` suitable for streaming responses.

#### Scenario: Handler runs on the Node runtime
- **WHEN** the assistant route is built
- **THEN** it declares the Node runtime and a streaming-appropriate max duration

### Requirement: Authenticated, owner-scoped access
The pipeline SHALL authenticate via `getCurrentUser()` and verify the current user owns the
requested `campaignId`. A request from an anonymous user SHALL be rejected; a request for a
campaign the user does not own SHALL return 404 (existence not revealed).

#### Scenario: Anonymous request is rejected
- **WHEN** an unauthenticated request hits the assistant
- **THEN** it is rejected and no data is read or generated

#### Scenario: Cross-user campaign yields 404
- **WHEN** an authenticated user asks about a campaign they do not own
- **THEN** the response is 404 and no campaign data is retrieved or sent to the model

### Requirement: Validated, clamped, bounded input
The pipeline SHALL Zod-validate the request, clamp the question to a maximum length, strip
control characters, and reject oversized request bodies before any model call.

#### Scenario: Oversized body is rejected
- **WHEN** a request body exceeds the configured size limit
- **THEN** it is rejected before retrieval or generation

#### Scenario: Question is clamped and sanitized
- **WHEN** a question exceeds the max length or contains control characters
- **THEN** it is clamped/stripped before being used in the prompt

### Requirement: Scoped retrieval with per-type caps
The pipeline SHALL retrieve ONLY the requested campaign's records, through the user-scoped
data layer, with a per-type row cap so the context cannot be flooded.

#### Scenario: Only the owned campaign's records are retrieved
- **WHEN** the pipeline gathers context
- **THEN** it reads only that campaign's records via the owner-scoped data layer, capped per entity type

### Requirement: Grounded, injection-resistant prompt
The pipeline SHALL build a prompt that wraps the retrieved records as untrusted
`<campaign_data>` and instructs the model to answer ONLY from that data, to say "I don't
know" when the answer is not present, and to IGNORE any instructions found inside the data.

#### Scenario: Model answers only from campaign data
- **WHEN** a question's answer is not present in the campaign data
- **THEN** the assistant responds that it does not know rather than inventing an answer

#### Scenario: Injected instructions in data are ignored
- **WHEN** a campaign record contains text resembling an instruction (e.g. "ignore previous instructions")
- **THEN** the assistant treats it as data and does not act on it

### Requirement: Hardened, tiered generation
The pipeline SHALL call the LLM provider with low temperature, a hard `maxOutputTokens` cap,
an `AbortSignal` timeout, retry-with-backoff, and provider fallback, and SHALL cache the
static system prompt. It SHALL classify intent first with a cheap model, answer with a
mid-tier model, and escalate to the high-tier model only when the classifier flags the
question as hard. The answer SHALL be streamed.

#### Scenario: Cheap classify, then tiered answer
- **WHEN** a question is received
- **THEN** a cheap model classifies it, and the answer is produced by the mid-tier model unless the classifier flags it hard, in which case the high-tier model is used

#### Scenario: Generation is bounded and streamed
- **WHEN** the answer is generated
- **THEN** it respects the max-output cap and timeout, retries/falls back on failure, and is streamed to the client

### Requirement: Accessible chat UI with sanitized rendering
The assistant SHALL provide a client chat UI (using the AI SDK's `useChat`) mounted on the
campaign page that renders responses through a sanitizing markdown renderer and NEVER renders
raw HTML. It SHALL show streaming indicators, error and empty states, and accessible markup.

#### Scenario: Responses render as sanitized markdown
- **WHEN** the assistant streams a response containing markdown or HTML-like text
- **THEN** it renders through the sanitizing renderer with raw HTML stripped/escaped

#### Scenario: UX states are present and accessible
- **WHEN** the chat is pending, errored, or empty
- **THEN** a streaming indicator, error state, or empty state is shown with accessible markup

### Requirement: Rate limits and daily token budget
The assistant SHALL enforce per-user AND per-IP rate limits via the external store, and a
per-user daily token budget. Exceeding any limit SHALL block the request before generation.

#### Scenario: Per-user rate limit blocks excess requests
- **WHEN** a user exceeds their request rate limit
- **THEN** further requests are rejected until the window resets, with no model call

#### Scenario: Per-IP rate limit blocks excess requests
- **WHEN** requests from one IP exceed the per-IP limit
- **THEN** further requests from that IP are rejected

#### Scenario: Daily token budget caps usage
- **WHEN** a user's consumed tokens for the day reach the budget
- **THEN** further assistant requests are blocked until the budget resets

### Requirement: Redacted logging and per-call audit
The assistant SHALL emit structured logs with prompts, PII, and secrets REDACTED, and SHALL
write an audit record for each assistant call (who, which campaign, when, outcome, token
usage) without storing the prompt or answer text verbatim.

#### Scenario: Logs never contain prompt/PII/secrets
- **WHEN** the assistant logs a call
- **THEN** the log contains no prompt text, PII, or secrets

#### Scenario: Each call writes an audit record
- **WHEN** an assistant call completes (success or failure)
- **THEN** an audit record is written capturing the user, campaign, timestamp, outcome, and token usage
