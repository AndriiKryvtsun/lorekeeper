## 1. Proposal schema & validation

- [x] 1.1 Add `lib/validation/assistant-proposal.ts`: a Zod discriminated union keyed on `entity` (`npc`|`location`|`item`|`session`|`character`) with `action` (`create`|`update`|`delete`), `campaignId`, and `fields` that REUSE the existing per-entity create/update input schemas (single source of truth); `update`/`delete` carry a target reference (name) resolved server-side, not an id from the model
- [x] 1.2 Add a server-side reference resolver: map a proposed entity name to an id against the owner-scoped retrieved records; reject zero-match or ambiguous (multi-match) references

## 2. Intent routing (extends the assistant pipeline)

- [x] 2.1 Extend the cheap classify step in `lib/ai/assistant-service.ts` to classify the USER MESSAGE ONLY as `question` vs `write`, and for `write` capture `{ action, entity }`; campaign data is never an intent source (injection-safe)
- [x] 2.2 Route `question` to the existing grounded Q&A path unchanged; route `write` to proposal generation

## 3. Proposal generation (model proposes, never writes)

- [x] 3.1 In `assistant-service.ts`, for a write intent call `generateObject` with the proposal schema to produce `{ action, entity, campaignId, fields }`; validate output with Zod at the boundary and reject malformed output (never returned as committable)
- [x] 3.2 Ensure the generation path performs NO database access/mutation; add a redacted `proposal_generated` audit event (user, campaign, action, entity, outcome) via `lib/ai/audit.ts`
- [x] 3.3 Emit the proposal to the client as a typed `data-proposal` part on the existing UI message stream, plus a short assistant text; keep all vendor stream code inside `lib/ai`
- [x] 3.4 When neither a grounded answer nor a valid proposal applies, return a helpful capability message instead of the bare "I don't know" fallback

## 4. Confirm-before-write commit

- [x] 4.1 Add an `assistant.commitProposal` tRPC mutation: re-authenticate, re-validate the proposal with the same Zod schema, verify ownership of `campaignId` (404 on mismatch, existence not revealed), resolve any name reference server-side, then dispatch to the EXISTING owner-scoped data-layer function for the entity/action
- [x] 4.2 Write a redacted `proposal_committed` audit event tied to the confirming user (action, entity, ids, outcome) on success and failure
- [x] 4.3 Confirm the model is absent from the commit path (commit imports no `lib/ai` generation code)

## 5. Proposal-card UI

- [x] 5.1 Add `components/assistant/proposal-card.tsx`: renders a summary of the proposed change with accessible Confirm / Cancel actions; reads the `proposal` part from the chat message
- [x] 5.2 On Confirm, call the `assistant.commitProposal` mutation; on success show a confirmation and disable the card; on Cancel discard the proposal with no write; surface commit errors (incl. 404) accessibly
- [x] 5.3 Render the proposal card from the chat message parts in the existing chat component (no raw HTML; reuse the sanitizing renderer for any text)

## 6. Tests

- [x] 6.1 Intent routing: a question routes to Q&A (no proposal); a create/update/delete message routes to proposal generation; injected write-like text inside `<campaign_data>` does NOT trigger a write
- [x] 6.2 Proposal schema validation: well-formed model output parses; malformed/over-scoped output is rejected and never returned as committable; name resolution rejects zero/ambiguous matches
- [x] 6.3 Confirm-before-write guard: no write occurs without an explicit `commitProposal` call; `commitProposal` rejects a cross-user `campaignId` with 404 and re-validates input before writing
- [x] 6.4 Audit: `proposal_generated` and `proposal_committed` records are written, redacted (no prompt/PII/secrets), and the commit audit ties to the confirming user
- [x] 6.5 Proposal-card UI: renders the change summary with Confirm/Cancel, posts the confirmation on Confirm, and writes nothing on Cancel (jsdom)

## 7. Verification

- [x] 7.1 Run `npx tsc --noEmit` and fix any type errors (no `any`)
- [x] 7.2 Run the Vitest suite (node + jsdom) and confirm all tests pass
- [x] 7.3 Confirm `next build` succeeds; the commit path stays owner-scoped and vendor SDKs stay confined to `lib/ai`
