## Why

The assistant can already propose a write, but the binding between "what the user asked for" and
"what the application does" is spread across the classifier prompt, prose field hints, a per-entity
schema map, and a commit switch. Nothing declares the closed set of permitted operations in one
place, and there is no path for the assistant to ask a question instead of guessing: when the
user's message lacks a required field, the model fills a value in and the user confirms a change
they did not describe.

This change closes that gap. Every permitted write becomes one entry in a code-owned action
registry; the model produces only an action plan and a payload; deterministic code resolves the
operation, enforces the scope, validates the payload, and returns one normalised envelope. It is
the foundation `add-ai-chat-injection-defense` and the assistant evaluation change build on.

## What Changes

- Add an **action registry**: a closed list of `(action, entity)` pairs, each bound in code to
  exactly one owner-scoped operation, one payload schema, and one required scope string. A pair
  absent from the registry is not executable — there is no fallback path.
- Add a **declared, ownership-backed scope** per registry entry (e.g. `campaign:npc:write`),
  enforced at execution by resolving to the existing owner-scoped data layer. No new permission
  storage and no new user-facing concept.
- Promote intent and entity classification to an explicit **action plan**: a machine-readable
  `{ action, entity, confidence, missingFields, clarification }` record, derived from the user's
  message only, that must resolve to a registry entry before anything else runs.
- Add a **schema-constrained structured output contract** for payload generation, driven from the
  registry entry's payload schema rather than hand-written prose field hints.
- Add a **validation layer** that checks the model's payload against the registry entry's schema
  independently of the model, before any operation is invoked.
- Add a **clarification loop**: missing, ambiguous, or contradictory input yields a question and no
  proposal. A partially populated payload is never presented for confirmation.
- Make **execution deterministic**: application code resolves operation and scope from the registry;
  the model supplies payload data only and is absent from the execution path.
- Keep **explicit user confirmation** before every write, now gated on a payload that passed
  independent validation.
- Add a **response envelope with error normalisation** covering success, clarification-needed,
  validation failure, operation failure, and transport failure, so the chat UI renders one shape.
- Add **bounded context assembly**: pinned instructions, truncated conversation history, and
  per-entity schema injection scoped to the resolved registry entry.

**BREAKING**: none. Read behaviour is unchanged and the existing write path is refactored onto the
registry without changing what a user can commit.

## Capabilities

### New Capabilities
- `assistant-actions`: the closed action registry, its scope binding, the action-plan contract, and
  deterministic operation resolution and execution.
- `assistant-validation`: independent payload validation against the registry schema, the
  clarification loop for missing/ambiguous/contradictory input, and bounded context assembly.
- `assistant-responses`: the single response envelope and the normalisation of every success and
  failure mode into it.

### Modified Capabilities
- `assistant-proposals`: proposal generation and commit are re-expressed in terms of the registry
  and the validation layer. Write-intent detection now produces an action plan; structured
  generation is driven by the registry's payload schema; the commit path resolves its operation and
  scope from the registry instead of an internal switch. Human confirmation and audit requirements
  are unchanged in intent, and requirements now owned by the three new capabilities are removed here
  so no requirement is asserted twice.

## Impact

- **Affected specs**: `assistant-actions` (new), `assistant-validation` (new),
  `assistant-responses` (new), `assistant-proposals` (modified).
- **Affected code**:
  - `lib/ai/assistant-service.ts` — classification, payload generation, and the write branch move
    onto the action plan, registry, and envelope; `FIELD_HINTS` is replaced by schema injection.
  - `lib/validation/assistant-proposal.ts` — `createFieldSchemas`/`updateFieldSchemas` become the
    payload half of registry entries.
  - `lib/data/proposal.ts` — `commitProposal`'s per-entity switch becomes registry lookup.
  - `src/server/api/routers/assistant.ts` — commit resolves operation and scope from the registry
    and returns the envelope.
  - New: the registry module, the payload validator, and the envelope/normalisation module.
  - `components/assistant/*` — `proposal-card` and `assistant-panel` render the envelope, including
    the clarification state.
- **Not affected**: the grounded Q&A path, ownership and 404 semantics, rate limits, token budget,
  redacted logging, and the audit record shape.
- **Constraints honoured**: writes stay on Prisma via the owner-scoped data layer and tRPC (there is
  no outbound HTTP POST; "operation" means a registry-bound owner-scoped mutation). No vendor SDK
  import outside `lib/ai/`. Retrieved campaign data stays untrusted data, never instructions.
- **Downstream**: `add-ai-chat-injection-defense` (hardens the action-plan boundary),
  assistant evaluation (scores against the registry and envelope). Neither change exists yet in
  `openspec/changes/`.
