## Context

The write path already exists end to end: `classifyIntent` picks an action and entity,
`generateProposal` asks the model for fields, `parseProposal` validates them, `proposal-card`
confirms, and `assistantRouter.commitProposal` delegates to `commitProposal`, which writes through
the owner-scoped data layer. What is missing is a single declaration of what may be written, and a
way to ask instead of guess.

Current state, concretely:

- The `(action, entity)` to operation binding is spread over four places: `PROPOSAL_ACTIONS` and
  `PROPOSAL_ENTITIES` in `lib/validation/assistant-proposal.ts`, `createFieldSchemas` /
  `updateFieldSchemas` beside them, the prose `FIELD_HINTS` in `lib/ai/assistant-service.ts`, and
  `commitProposal`'s per-entity switch in `lib/data/proposal.ts`. Adding an entity means editing
  all four, and nothing fails if one is missed.
- There is no scope concept. Authorisation is campaign ownership, re-checked inside each data-layer
  function — correct, but undeclared and absent from the audit record.
- `runAssistant` takes a single `question` string. There is no conversation history, so a follow-up
  answer cannot continue a write; the model must fill every required field on the first turn or the
  request dies in `HELP_TEXT`.
- Three distinct failures — unsupported action, unparseable or invalid payload, and an unresolved
  target — all return prose through `textResponse`, so the client cannot tell them apart and the
  user is told to rephrase when the real problem is one missing field.
- `generateProposal` builds a proposal from whatever the model produced. When the user's message
  omits a required field, the model supplies a plausible value and the user confirms something they
  never said.

Constraints inherited from the project: Prisma is the only data-access layer and writes go through
the existing owner-scoped functions and tRPC — "operation" here never means an outbound HTTP
request; no vendor SDK may be imported outside `lib/ai/`; retrieved campaign data is untrusted
data; the model may propose but never commit; every change ships with tests and a clean
`npx tsc --noEmit`.

## Goals / Non-Goals

**Goals:**

- One closed, typed registry that is the only place an `(action, entity)` pair becomes an
  executable operation, with its payload schema and required scope attached.
- Make an unregistered pair unreachable, and make adding an entity a single-place edit that fails
  compilation if left incomplete.
- Ask a question whenever a required value is missing or a target is ambiguous, and never present a
  payload the user did not fully describe.
- Derive the model's output contract from the registry's schemas, so schema and prompt cannot
  diverge.
- Return every write-path outcome in one discriminated envelope the UI switches on, with failures
  normalised and no internal detail leaked.
- Bound the context deterministically: pinned instructions that cannot be displaced, truncated
  history, and schema injection for the resolved entity only.

**Non-Goals:**

- No user-facing permission model. Scope stays a declaration backed by campaign ownership; no
  Prisma model, migration, or grant management.
- No change to the grounded Q&A path, retrieval caps, rate limits, token budget, redacted logging,
  or the audit record shape (scope is added as a field; nothing is removed).
- No new entities or actions. The registry starts as exactly today's five entities times three
  actions.
- No rework of entity enrichment (SRD/agent draft review). Its inline source choice is re-expressed
  as a clarification, but the draft-review flow itself is untouched.
- No multi-action or batched writes. One plan resolves to exactly one entry.
- No autonomous retry of a rejected payload by asking the model to re-judge its own output.

## Decisions

### 1. Split the registry across the server boundary, with type-enforced parity

The registry is one logical table in two modules, because the payload schemas and envelope types
must stay client-safe while the operations pull in Prisma:

- `lib/validation/assistant-actions.ts` (isomorphic) — the closed action-key list, each entry's
  scope string, its payload schema, and a short field descriptor used for context injection.
- `lib/data/action-registry.ts` (`server-only`) — the operation bound to each key.

Drift is prevented by typing the server table as `Record<ActionKey, ActionOperation>`, so a missing
or extra key is a `tsc` error rather than a runtime surprise, plus one test asserting key parity in
both directions.

*Alternative considered:* a single server-only registry holding everything. Rejected — the UI needs
the envelope and payload types, and importing them would drag `lib/data` (and Prisma) into the
client bundle, breaking the isomorphic rule the SDK spec already enforces elsewhere.

### 2. Scope is a compile-time declaration backed by ownership

Each entry declares a scope string such as `campaign:npc:write`. It is not checked against a grant
store — it is enforced by construction: `ActionOperation` is typed to require `(ownerId, campaignId,
...)`, so only an owner-scoped function can be bound, and that function performs the ownership check
that already exists. The scope string's runtime job is to be the audit and telemetry label, and to
make the authorised surface reviewable on one screen. A scope-like value arriving in model output or
in the commit input is dropped before resolution.

*Alternative considered:* a real scope enum persisted per user and campaign. Rejected as out of
proportion — the app has exactly one principal per campaign, so a grant table would encode "the
owner may do everything" and add a migration for no behavioural gain.

### 3. Keep provider-portable text generation; derive only the contract from the schema

Payload generation keeps today's transport — `provider.generate()`, JSON extraction, then Zod —
because the port's `generateObject` maps to AI SDK structured output that Groq's Llama models
reject, and Groq is a configured fallback in `lib/ai/tiers.ts`. What changes is where the contract
comes from: instead of the hand-maintained `FIELD_HINTS`, the instruction text is rendered from the
resolved entry's Zod schema (field names, types, required or optional, enums, bounds). Schema and
prompt then cannot diverge, and the successor to `parseProposal` stays the single validation
boundary.

*Alternatives considered:* (a) `generateObject` everywhere — rejected, it breaks the fallback
provider; (b) `generateObject` when the provider supports it with a text fallback otherwise —
rejected, two generation paths double the surface that must be tested for equivalent validation
behaviour.

### 4. Missing fields are derived from validation, not self-reported by the model

The action plan carries the action and entity; it does not carry the model's opinion about what is
missing. Missing required values are computed deterministically from the validator's own Zod
issues: issues marking an absent or wrongly-typed required key are mapped, by path, through the
entry's field descriptors into a question. A model that never mentions a required field cannot hide
that it is required, and a model that claims a field is missing cannot invent one.

*Alternative considered:* asking the classifier to list the missing fields. Rejected — it makes the
clarification loop only as reliable as the cheapest model in the stack, and the schema already
knows the answer.

### 5. Target resolution distinguishes "none" from "many"

`resolveEntityIdByName` currently returns `null` for both "no match" and "several matches", which is
why the user gets one vague message today. It becomes a discriminated result:
`{ kind: "one", id }`, `{ kind: "none" }`, or `{ kind: "many", candidates }`. "none" asks for the
exact name; "many" asks which one, listing the candidate names. Neither writes, and neither picks a
near match.

### 6. Contradiction detection is the one model-sourced clarification trigger, and fails safe

A contradiction ("call him Sera — no, Kael") cannot be recovered from a payload, because the model
collapses it before validation sees it. So the classifier emits a boolean contradiction signal
alongside the plan, and it is the only clarification trigger not derived from code. That is
acceptable because its failure modes are asymmetric: a false positive costs one extra question, and
a false negative degrades to today's behaviour — the model picks a value, which the user sees in the
confirmable card before anything is written.

### 7. The route accepts bounded history instead of a single question

The clarification loop needs the previous turn, so the request body becomes a bounded message list
rather than one `question` string: Zod-validated, capped in count and per-message length, with the
existing control-character stripping and body-size limit applied to each entry. `useChat` already
holds these messages client-side, so the client change is what it sends, not how it works.

Assembly order is fixed: pinned instructions, then the resolved entry's schema descriptor, then
truncated history (most recent turns plus any in-flight clarification), then the capped, fenced
`<campaign_data>`. Truncation drops oldest history first and never touches the pinned instructions.

*Alternative considered:* server-side clarification state keyed by a token. Rejected — it needs
storage and expiry for something the client already has, and it would let stale server state
resurrect a write the user had abandoned.

*Correction (found in testing):* bounded history in the context is **necessary but not
sufficient** — see Decision 9. Classification reads the latest user message only, so history
never reaches the step that decides whether a turn is a write at all.

### 9. Resuming a clarification needs a server-emitted pending action, not history

Decision 7 assumed that carrying history into the context was enough to continue a write after a
clarification. It is not: `classifyActionPlan` sees the latest user message alone (by design —
Decision 4 and the injection-safety requirement), so an answer like "The dark canyon" classifies
as a question and falls through to grounded Q&A. The clarification loop asked the question and
then dropped the write on the floor.

The fix is a **pending action**: the `clarification` envelope carries
`{ action, entity, needs, fields?, target? }` — the registry key the question belongs to plus the
partial values already gathered. The client echoes it with the user's answer, and when it is
present the pipeline resolves it against the registry and **skips classification entirely**,
resuming the same entry with the carried values merged under whatever the answer supplies.

Why this keeps the injection guarantee. The pending action arrives from the client, which is the
*user's* channel — and the user could always type "create a location named X", so echoing it back
grants no capability they did not already have. What must never happen is intent originating in
untrusted *content*: retrieved `<campaign_data>`, or a forged assistant turn in history. Both stay
excluded, because classification still never reads them, and a pending action is a structured
registry key rather than prose to be interpreted. Everything downstream is unchanged — registry
resolution, independent validation, and human confirmation all still gate the write, and the
carried `fields` are re-validated against the entry's schema like any other payload.

*Alternative considered:* letting the classifier see the last assistant turn. Rejected — it would
make a forged assistant turn in client-supplied history a source of write intent, which directly
contradicts the `assistant-actions` requirement that a plan derive only from the user's own
message. Ten lines of code for a materially weaker invariant.

### 8. One envelope over the existing stream; the enrichment source choice becomes a clarification

The envelope is a discriminated union — `success`, `clarification`, `proposal`, `validation_error`,
`operation_error`, `transport_error` — declared in the isomorphic module and written as a single
typed data part on the existing `createUIMessageStream`, replacing today's mix of `data-proposal`,
`data-source-choice`, and bare `textResponse` prose. The grounded Q&A path keeps streaming text
unchanged; the envelope governs the write path only.

The enrichment source choice is a question with a fixed set of answers and nothing confirmable, so
it is modelled as a `clarification` carrying `options` rather than as a seventh outcome. That keeps
the outcome set closed and leaves the existing draft-review components consuming the chosen option
as they do now. The `proposal` outcome carries today's `Proposal` value unchanged, so
`proposal-card` keeps its props and the UI churn stays in `assistant-panel`'s dispatch on the
discriminator.

Normalisation lives in one function: typed SDK errors (`TimeoutError`, `RateLimitError`,
`UpstreamError`, `CircuitOpenError`) map to `transport_error`; data-layer refusals and not-found map
to `operation_error`; schema failures and unsupported actions map to `validation_error`; anything
unrecognised maps to `transport_error` with a generic message. Diagnostic detail continues to go to
the redacted server log, never into the envelope.

## Risks / Trade-offs

- **The two-module registry drifts** — The server table is typed as an exhaustive
  `Record<ActionKey, ...>`, so a gap fails `tsc`, and a parity test asserts both directions.
- **Rendering a Zod schema into prompt text drifts from what Zod actually enforces** (a refinement
  no renderer can express, say) — The renderer is derived from the schema, never hand-written, and
  validation remains the boundary: an unexpressible constraint costs a clarification round-trip,
  not a bad write.
- **The clarification loop adds model round-trips and tokens** — History is capped, and the existing
  per-user daily token budget and rate limits still gate every turn; a clarification is one cheap
  classify plus one bounded generation.
- **Accepting a message list widens the input surface** (history is user-controlled and could fake a
  prior assistant turn) — Each message is Zod-validated, capped, and stripped; history is only ever
  context, never a source of an action plan. The plan comes from the latest user message, and the
  registry is what makes a pair executable. The injection-defence change hardens this boundary
  further.
- **A false-negative contradiction signal still lets the model pick a value** — Bounded by
  confirm-before-write: the value is visible in the card before any write.
- **Refactoring `commitProposal` and `resolveEntityIdByName` touches a well-tested path**
  (`lib/data/proposal.test.ts`, `proposal.provenance.test.ts`, `assistant-service.test.ts`,
  `routers/assistant.test.ts`) — Behaviour is preserved by construction: same schemas, same
  operations, same ownership checks. Existing tests are updated for the new result shapes rather
  than rewritten, and enrichment provenance (`source`, `attribution`) rides along on the `create`
  payload untouched.
- **The envelope is a breaking contract inside the stream** — Both sides ship in this change; there
  is no external consumer of the stream's data parts.

## Migration Plan

No data migration and no schema change. Sequence: land the isomorphic registry and envelope types
first (pure additions), then the server binding table with its parity test, then the validator and
clarification derivation, then rewire `assistant-service.ts` and the commit router onto them —
deleting `FIELD_HINTS` and `commitProposal`'s switch as the last step, so nothing ever runs on two
paths. The route's message-list input and the panel's discriminator dispatch land together.
Rollback is a revert; no persisted state depends on the change.

## Open Questions

- Clarification question text is assembled from the registry's field descriptors. If that reads
  poorly for a field like `session.date` (ISO 8601), the descriptor gains an explicit `prompt`
  string — deferred until the copy is seen in practice.
- Whether the audit record should carry the clarification count for a completed write. Useful for
  the evaluation change downstream, but not required by any requirement here.

### 10. Explicit delegation is the one narrow carve-out from "never invent"

Manual testing surfaced a dead end: asked to create an item, the assistant requests the missing
name; the user answers "create your own item name"; the pinned rules forbid inventing, so the
model omits the name, validation finds it missing again, and the same question repeats forever.
The rule was doing exactly what it was written to do, and the product was still stuck.

The carve-out is deliberately narrow. The classifier emits a `delegated` signal from the user's
own latest message; when it is set, the write path swaps the pinned "never invent a value" rule
for one that permits inventing **only the fields the user did not supply**, and the proposal
reports which fields it generated. Three properties are preserved: delegation itself can only come
from the user's message (never from `<campaign_data>` or an earlier turn — the same rule as write
intent); generated values are never lifted from retrieved records; and confirm-before-write still
gates every write, so a generated value is visible, labelled, and rejectable before it is
persisted.

`generated` is computed deterministically — the keys of the validated payload minus the keys
carried from earlier turns — rather than asked of the model. Over-marking a field the user did
supply is a harmless label; trusting the model to report its own inventions is not.

One consequence: the resume path now runs the cheap classifier again, because delegation arrives
on the *answering* turn, which is exactly the turn that previously skipped classification. On a
resume its `kind`/`action`/`entity` are ignored — the pending action already fixed the intent — and
only `delegated` is read. That is one extra cheap-tier call per resumed turn, in exchange for the
signal being available where it actually occurs.

*Alternative considered:* extending entity enrichment (the NPC/Character "Generate" flow) to every
entity, so generation stays an explicitly clicked action and "never invent" needs no exception.
Rejected for this change as disproportionate — it means new prompts, router procedures, and
draft-review UI for three more entity types — but it remains the better long-term home for
generation, and this carve-out does not block it.
