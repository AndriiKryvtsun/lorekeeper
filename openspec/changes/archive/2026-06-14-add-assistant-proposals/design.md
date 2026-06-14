## Context

The assistant (`lib/ai/assistant-service.ts` + `app/api/assistant`) is a grounded, read-only
Q&A pipeline: classify → retrieve owned campaign records → grounded streamed answer. Project
rules are firm: the model NEVER mutates the database — it may PROPOSE, and a human confirms
before any write. The CRUD write paths already exist as owner-scoped tRPC mutations backed by
the Prisma data layer, each with its own Zod input schema and ownership checks. This change
adds a write path to the assistant that reuses those mutations behind a confirmation gate.

## Goals / Non-Goals

**Goals:**
- Detect create/update/delete intent from the user's own message and emit a structured,
  Zod-validated proposal — never a direct write.
- Render the proposal as a confirm/cancel card in the existing chat UI.
- On confirm, commit through the EXISTING owner-scoped mutation, re-checking ownership and
  re-validating input server-side.
- Keep the grounded Q&A path and its injection resistance intact.

**Non-Goals:**
- No new entity types or schema/migration changes; reuse existing entities and their schemas.
- No batch/multi-entity proposals in one turn (one proposal per write turn).
- No autonomous/agentic multi-step writes; exactly one human-confirmed write per proposal.
- No relaxation of rate limits, budget, or audit already enforced by the assistant.

## Decisions

### 1. Intent routing as an extension of classification
Extend the existing cheap-model step to classify the user message as `question` vs
`write`, and for `write` capture `action` + `entity`. Rationale: reuses the existing
classify tier and keeps one model round-trip before the expensive step. The classifier sees
ONLY the user message (not `<campaign_data>`), preserving injection safety — a write intent
cannot originate from retrieved data. Alternative considered: a separate dedicated
classifier call (rejected — extra latency for no benefit).

### 2. Proposal as a Zod-validated object — generated as text + JSON parse (not `generateObject`)
A new `lib/validation/assistant-proposal.ts` defines the proposal types and `parseProposal`,
whose per-entity `fields` REUSE the EXISTING create/update input schemas (single source of
truth — the same schemas the tRPC mutations validate with). So a proposal that validates is,
by construction, committable.

The model produces the fields as **plain-text JSON**, which we extract and validate with
`parseProposal` (Zod). We deliberately do NOT use the AI SDK's `generateObject`: it relies on
the provider's `response_format: json_schema`, which Groq's free Llama models reject outright,
and the structured-output-capable Groq models enforce strict schemas (every property must be
`required`) that our optional fields violate — and `@ai-sdk/groq` does not rewrite schemas for
strict mode. Generating text + parsing + Zod-validating is provider-portable (works on any
Groq/Anthropic/OpenAI chat model) and keeps Zod as the single validation boundary. The
classifier uses the same text+JSON+Zod technique for the same reason.

For `update`/`delete`, the model proposes a target by name; the server resolves the name to an
id against the owner-scoped retrieved records and rejects ambiguous/unresolved references
(resolution is server-side, never trusted from the model).

### 3. Deliver the proposal as a typed data part on the existing UI message stream
For a write intent the `/api/assistant` handler emits a short assistant text ("I've drafted a
change — review and confirm below.") plus a typed `data-proposal` part on the same AI SDK UI
message stream that `useChat` already consumes. The client renders a `ProposalCard` when it
encounters a `proposal` part. Rationale: one endpoint, one stream, no client-side pre-routing.
Alternative considered: a separate non-streaming proposal endpoint (rejected — the client
can't know intent before sending, so it would require a pre-classification round trip).

### 4. Commit via a dedicated `assistant.commitProposal` tRPC mutation
Confirm calls a single new tRPC mutation that: re-authenticates, re-validates the proposal
with the same Zod schema, resolves/verifies the target campaign ownership (404 on mismatch),
dispatches to the existing owner-scoped data-layer function for the entity/action, and writes
the commit audit. Rationale: centralizes the confirm-before-write guard and audit in one
typed, owner-scoped seam instead of scattering audit across every CRUD mutation; the model is
provably absent from this path. Alternative considered: calling each existing CRUD mutation
directly from the client (rejected — no central place for the commit audit and proposal
re-validation).

### 5. Audit reuses `lib/ai/audit.ts`
Two redacted events: `proposal_generated` (user, campaign, action, entity, outcome) and
`proposal_committed` (same, tied to the confirming user, success/failure). No field values
that could carry PII are logged verbatim — only action/entity/ids and outcome.

## Risks / Trade-offs

- **AI SDK data-part API specifics** → Use the documented UI-message stream writer for typed
  `data-*` parts; if the exact helper differs by version, fall back to emitting the proposal
  as a single JSON `data` part and parsing it client-side. Keep the vendor stream code inside
  `lib/ai` (boundary rule) and the client reading only its own parts.
- **Name→id resolution ambiguity for update/delete** → Resolve only against the owner-scoped
  retrieved records; on zero or multiple matches, reject the proposal and ask the user to
  disambiguate. Never let the model supply an id directly.
- **Model proposes invalid/over-scoped fields** → The proposal schema IS the mutation's input
  schema, and the commit re-validates; invalid fields are rejected at both boundaries.
- **Double-commit / replay** → The commit is an ordinary idempotent-by-confirmation user
  action through tRPC; the card disables after confirm/cancel. (No new dedupe store needed.)
- **Injection attempting to forge a write** → Intent is classified from the user message
  only; campaign data is never an intent source; the commit requires explicit human action.

## Open Questions

- Should `update`/`delete` ship in the first cut, or `create` first with update/delete
  following once name-resolution UX is proven? (Spec covers all three; implementation may
  stage them — tasks will note if deferred.)
