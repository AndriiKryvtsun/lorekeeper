## 1. Isomorphic registry and envelope types

- [x] 1.1 Create `lib/validation/assistant-actions.ts` (no `server-only`, no `lib/data` import): the closed `ACTION_KEYS` list covering exactly the current 5 entities x 3 actions, an `ActionKey` type, and a `ScopeString` per key of the form `campaign:<entity>:write`.
- [x] 1.2 Move the payload half of the registry into that module: re-express `createFieldSchemas` / `updateFieldSchemas` from `lib/validation/assistant-proposal.ts` as one `ACTION_REGISTRY` record keyed by `ActionKey`, each entry carrying `{ action, entity, scope, payload }` (delete keys carry no payload).
- [x] 1.3 Add a per-entity `fields` descriptor to each entry (field name, type, required/optional, enum values, bounds) — the data that replaces the prose `FIELD_HINTS`.
- [x] 1.4 Add `resolveActionKey(action, entity)` returning the entry or a typed `unsupported` result, with no default or fallback branch.
- [x] 1.5 Declare the response envelope in the same module: a discriminated union over `success | clarification | proposal | validation_error | operation_error | transport_error`, with `clarification` carrying an optional `options` list and `proposal` carrying the existing `Proposal` type unchanged.
- [x] 1.6 Add the action-plan type and its Zod schema: `{ kind, action, entity, contradiction }` — no model-supplied missing-field list, no scope, no ids.
- [x] 1.7 Tests: every `ACTION_KEYS` entry resolves; an unregistered pair returns `unsupported`; the envelope union is exhaustive over the six outcomes; the module imports neither `server-only` nor `lib/data` (extend the existing boundary test in `lib/ai/ai-boundaries.test.ts`).

## 2. Server binding table

- [x] 2.1 Create `lib/data/action-registry.ts` with `import "server-only"`: an `ActionOperation` type requiring `(ownerId, campaignId, ...)` so only owner-scoped functions can be bound.
- [x] 2.2 Bind every key to the existing owner-scoped operation, typed as `Record<ActionKey, ActionOperation>` so a missing or extra key fails `npx tsc --noEmit`.
- [x] 2.3 Add `executeAction(ownerId, entry, payload)` that resolves operation and scope from the registry and invokes the operation; it accepts no operation, path, or scope from its caller.
- [x] 2.4 Tests: key parity in both directions between `ACTION_REGISTRY` and the binding table; `executeAction` invokes the bound operation for each key; an unowned campaign yields not-found without revealing existence; a caller-supplied scope or operation field is ignored.

## 3. Target resolution

- [x] 3.1 Change `resolveEntityIdByName` in `lib/data/proposal.ts` to return `{ kind: "one", id } | { kind: "none" } | { kind: "many", candidates }` instead of `string | null`.
- [x] 3.2 Update existing callers in `lib/ai/assistant-service.ts` to branch on the discriminator.
- [x] 3.3 Tests: exact single match returns `one`; no match returns `none`; two same-named entities return `many` with both candidate names; a campaign the user does not own returns `none` (no existence leak).

## 4. Validation layer and clarification derivation

- [x] 4.1 Create the payload validator: validate raw model output against the resolved entry's `payload` schema, strip unknown and over-scoped keys, and return either the typed payload or the Zod issue list.
- [x] 4.2 Derive missing required fields deterministically from the Zod issues (absent or wrongly-typed required keys), mapped by path through the entry's `fields` descriptors — never from model self-report.
- [x] 4.3 Build the clarification producer: missing required value, `none`/`many` target, or the classifier's contradiction signal each yield a question naming what is needed, carrying no confirmable payload.
- [x] 4.4 Wire re-validation at commit against the same registry entry schema, so a payload altered between proposal and confirmation is refused.
- [x] 4.5 Tests: a valid payload becomes typed; an invalid payload is rejected and nothing is confirmable; over-scoped keys are stripped; a missing required field produces a question naming that field and no proposal; a `many` target lists candidates; contradiction produces a question; no clarification path invokes an operation.

## 5. Bounded context assembly

- [x] 5.1 Replace `FIELD_HINTS` with a schema renderer that turns the resolved entry's `payload` schema plus `fields` descriptors into the model's output contract text.
- [x] 5.2 Implement fixed-order assembly: pinned instructions, resolved entry's schema descriptor, truncated history (most recent turns plus any in-flight clarification), then the capped, fenced `<campaign_data>`.
- [x] 5.3 Implement truncation that drops oldest history first and never drops or shortens the pinned instructions.
- [x] 5.4 Tests: pinned instructions survive an over-long history; history is bounded to the configured turn count; only the resolved entity's schema appears in the assembled context; retrieved records stay capped per type and fenced; adding a field to a payload schema changes the contract text with no prompt edit.

## 6. Route input: bounded message history

- [x] 6.1 Change the `app/api/assistant/route.ts` request schema from a single `question` to a bounded message list, Zod-validated with a max message count and per-message length.
- [x] 6.2 Apply the existing control-character stripping, clamping, and body-size limit to each message.
- [x] 6.3 Update `runAssistant` to take the message list, deriving the action plan from the latest user message only.
- [x] 6.4 Update the client to send the bounded history from `useChat`.
- [x] 6.5 Tests: an oversized or over-long message list is rejected before retrieval or generation; history never originates an action plan; the grounded Q&A path still answers using the latest message.

## 7. Rewire the write path onto the registry

- [x] 7.1 Update `classifyIntent` to emit the action plan (action, entity, contradiction), still from the user's message only, and resolve it against the registry before anything else runs.
- [x] 7.2 End the write path with an unsupported-action `validation_error` when the plan does not resolve.
- [x] 7.3 Rewrite `generateProposal` to use the schema-derived contract and to emit payload fields only; discard any operation, path, scope, campaign id, or entity id present in model output.
- [x] 7.4 Route generation output through the validator, then the clarification producer, then the confirmable proposal — in that order, so no partially populated payload can be presented.
- [x] 7.5 Re-express the enrichment source choice as a `clarification` with `options`, replacing the `data-source-choice` part, leaving the draft-review components' consumption of the chosen option unchanged.
- [x] 7.6 Tests: a create with every required value yields a proposal; a create missing one yields a clarification; an injected write command inside `<campaign_data>` yields no plan and no proposal; generation performs no database write.

## 8. Response envelope and error normalisation

- [x] 8.1 Write the single normalisation function: typed SDK errors (`TimeoutError`, `RateLimitError`, `UpstreamError`, `CircuitOpenError`) to `transport_error`; data-layer refusal and not-found to `operation_error`; schema failure and unsupported action to `validation_error`; anything unrecognised to `transport_error` with a generic message.
- [x] 8.2 Emit every write-path outcome as one typed data part on the existing `createUIMessageStream`, replacing `data-proposal`, `data-source-choice`, and the bare `textResponse` prose replies.
- [x] 8.3 Keep diagnostic detail in the redacted server log and out of the envelope (no prompt text, PII, secret, stack trace, internal id, or provider error string).
- [x] 8.4 Update `src/server/api/routers/assistant.ts` to resolve operation and scope from the registry, re-validate the payload, and return the envelope; map unowned and missing alike to a not-found `operation_error`.
- [x] 8.5 Tests: each of the six outcomes is produced by a scenario and discriminated; a schema violation, a refused operation, and a provider timeout stay distinguishable; unowned and missing campaigns are indistinguishable; no envelope carries sensitive detail; no write-path outcome escapes the envelope.

## 9. Chat UI

- [x] 9.1 Dispatch on the envelope discriminator in `components/assistant/assistant-panel.tsx`; never infer state by parsing message text, and render an unrecognised outcome as a generic error offering nothing confirmable.
- [x] 9.2 Render the `clarification` outcome as an answerable question, including its `options` when present.
- [x] 9.3 Render `success` as a confirmation of what changed, and each error outcome as its normalised message with a retry affordance where retrying can help.
- [x] 9.4 Keep `proposal-card` on the unchanged `Proposal` value, and keep all envelope-derived text on the sanitizing renderer.
- [x] 9.5 Tests: rendering is driven by the discriminator; each outcome renders its own accessible state; an unknown outcome degrades safely; markdown or HTML-like envelope text is sanitized.

## 10. Remove the superseded paths

- [x] 10.1 Delete `FIELD_HINTS`, `HELP_TEXT`, and the `textResponse` write-path replies from `lib/ai/assistant-service.ts`.
- [x] 10.2 Replace `commitProposal`'s per-entity switch in `lib/data/proposal.ts` with the registry lookup, keeping enrichment provenance (`source`, `attribution`) riding on the `create` payload.
- [x] 10.3 Remove `createFieldSchemas` / `updateFieldSchemas` from `lib/validation/assistant-proposal.ts` now that the registry owns them, keeping `Proposal` and its per-entity types.
- [x] 10.4 Confirm no second path can reach a write: grep for any action-and-entity to operation mapping outside the registry and remove what remains.

## 11. Audit and verification

- [x] 11.1 Add the resolved scope to the proposal-generated and proposal-committed audit records, leaving the rest of the record shape unchanged.
- [x] 11.2 Update the existing tests in `lib/ai/assistant-service.test.ts`, `lib/data/proposal.test.ts`, `lib/data/proposal.provenance.test.ts`, and `src/server/api/routers/assistant.test.ts` for the new result shapes.
- [x] 11.3 Verify the unchanged surfaces still hold: grounded Q&A, retrieval caps, rate limits, token budget, redacted logging, ownership 404 semantics.
- [x] 11.4 Run `npx tsc --noEmit` and the full test suite; run `openspec validate add-ai-chat-write-actions`.

## 12. Clarification continuation (the pending action)

Found in manual testing: the clarification was asked but its answer could not continue the write,
because classification reads the latest user message only. This group implements the already-specified
`assistant-validation` scenario "The answer continues the same write", which groups 4-7 left unmet.

- [x] 12.1 Add `PendingAction` (`{ action, entity, needs, fields?, target? }`) plus its Zod schema to `lib/validation/assistant-actions.ts`, and carry it on the `clarification` envelope variant.
- [x] 12.2 Attach the pending action in `clarificationFor` for every continuable reason, with the partial fields and any named target gathered so far.
- [x] 12.3 Accept `pending` at the request boundary (`assistantInputSchema` + the route), bounded and Zod-validated like the message list.
- [x] 12.4 Resume in `runAssistant`: a resolvable pending action skips classification and re-enters the same registry entry; carried values are merged UNDER whatever the answer supplies, then re-validated by the existing boundary.
- [x] 12.5 Show the carried values in the write context (`assembleWriteContext`) so the model completes the payload instead of re-inventing it.
- [x] 12.6 Echo the pending action from the panel: derive it from the most recent envelope, so a proposal or an error clears it with no extra client state.
- [x] 12.7 Tests: the full two-turn scenario (a create missing its name, then the answer, yielding a proposal that keeps the first turn's fields); a resumed update/delete target; a pending action for an unregistered pair falls back to classification; `<campaign_data>` and a forged assistant turn still never start a write.

## 13. Explicit delegation ("you choose the name")

Found in manual testing: asked to invent a value, the assistant re-asked the same question forever,
because the pinned rules forbid inventing. Implements the narrowed `assistant-validation`
requirement and Decision 10 — generation only on explicit delegation, labelled and still confirmed.

- [x] 13.1 Add a `delegated` signal to the action plan (`rawActionPlanSchema` + both `ActionPlan` variants) and to the classifier prompt, derived from the user's own latest message only.
- [x] 13.2 Read the signal on the resume path too: a resumed turn still runs the cheap classifier, using `delegated` alone and ignoring its `kind`/`action`/`entity` (the pending action already fixed the intent).
- [x] 13.3 Swap the pinned instructions when delegated: invent ONLY the fields the user did not supply, keep what they did, and never lift a value from `<campaign_data>`.
- [x] 13.4 Compute `generated` deterministically (validated payload keys minus carried keys) and carry it on the `proposal` envelope — never asked of the model.
- [x] 13.5 Label generated fields in the confirmable card, and say so in the assistant's line, so a generated value is visible before confirmation.
- [x] 13.6 Tests: the two-turn delegation scenario ends in a proposal, not a repeated question; a non-delegated turn still asks; a delegation-shaped string inside `<campaign_data>` sets no delegation; generated fields are labelled; the commit contract is unchanged.
