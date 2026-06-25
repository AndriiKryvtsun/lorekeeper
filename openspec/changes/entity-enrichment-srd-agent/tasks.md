## 1. Data model & env

- [x] 1.1 Add nullable `source` (`"srd" | "agent"`) and `attribution` (string) columns to `NPC` and `Character` in the Prisma schema
- [x] 1.2 Create a Prisma migration adding the columns (existing rows backfill to null; no RLS change)
- [x] 1.3 Add SRD env keys to `~/env`: `SRD_PROVIDER` (default `open5e`), `SRD_FALLBACK` (default `dnd5eapi`), `OPEN5E_BASE_URL`, `DND5EAPI_BASE_URL` — server block + `runtimeEnv`

## 2. SRD capability on the API SDK

- [x] 2.1 Add `lib/sdk/capabilities/srd/port.ts`: a single `SrdPort` with `lookup(kind, query) → SrdCandidate[]` and the `SrdCandidate` type (mapped data + `source` + `attribution`)
- [x] 2.2 Add `lib/sdk/capabilities/srd/adapters/open5e.ts`: GET via shared `request()` (idempotent, timeout, shared circuit), Zod-validate the Open5e response, map into the entity create-schema shape with OGL/CC attribution
- [x] 2.3 Add `lib/sdk/capabilities/srd/adapters/dnd5eapi.ts`: same `SrdPort`, mapping the dnd5eapi response shape
- [x] 2.4 Add `lib/sdk/server/srd.ts` (`import "server-only"`): build the `Registry<SrdPort>` from `~/env` selection + base URLs, hold one shared `CircuitBreaker`, expose `lookupSrd` via `callWithFallback`
- [x] 2.5 Derive match arity (0 = none, 1 = exact, >1 = list) from the candidate count

## 3. Unified proposal contract & commit

- [x] 3.1 Extend `proposalEnvelopeSchema` + `parseProposal` with optional `source: "srd" | "agent"` threaded through `action: "create"` (kind ↔ entity, data ↔ fields)
- [x] 3.2 Persist `source` + `attribution` in `commitProposal` create path (NPC/Character) without adding a second write path
- [x] 3.3 Include `source` in the commit audit record (redacted; no prompt/PII/secrets)

## 4. Propose procedures (tRPC, non-streaming)

- [x] 4.1 Add a per-user propose rate limiter (reuse `lib/ai/rate-limit` Upstash setup with an `enrich:user` prefix; disabled when unconfigured)
- [x] 4.2 Add `enrichmentRouter` with `proposeFromSrd(kind, campaignId, query)` — `protectedProcedure`, verify campaign ownership (404 on mismatch), rate-limit first, call `lookupSrd`, return unified proposal / candidate list
- [x] 4.3 Add `proposeFromAgent(kind, campaignId, prompt)` — `protectedProcedure`, ownership + rate-limit, `getProvider("answer").generate()` → extract JSON → validate against the create-schema (provider-portable; not `generateObject`, which some providers/models reject), return unified proposal
- [x] 4.4 Mount `enrichmentRouter` on the app router

## 5. Entry point 1 — entity form

- [x] 5.1 Add a secondary "Enrich from SRD" action next to the name field (NPC; Character only if statblocks modeled), enabled only when the name has text; manual entry stays primary
- [x] 5.2 Add an agent "Generate" action for both NPC and Character
- [x] 5.3 On result, fill the SAME form fields; write nothing until explicit save/Apply

## 6. Entry point 2 — chat assistant

- [x] 6.1 Classify create-intent source with `getProvider("classify")` (haiku) → `srd-likely | original | ambiguous`, derived ONLY from the user message
- [x] 6.2 Render two inline source-choice buttons ONLY when `ambiguous`; default to the classified source otherwise
- [x] 6.3 Route both paths to the unified proposal + existing confirm-before-commit card; never auto-write

## 7. Shared review, match picker & revalidation

- [x] 7.1 Build the single editable review panel (Apply/Cancel) used by both surfaces and both sources; committed data is the edited data
- [x] 7.2 Build the accessible multiple-match picker; no-match falls back quietly to manual entry
- [x] 7.3 Wrap commit in a Server Action that calls `commitProposal` + `revalidatePath(campaign route)`
- [x] 7.4 On commit success, invalidate the entity-list queries by consistent path-derived keys and call `router.refresh()` — from both the form and the chat widget (shared query client)

## 8. Security & accessibility

- [x] 8.1 Enforce ownership on BOTH propose and commit; SRD/LLM calls server-side only
- [x] 8.2 Zod-validate untrusted SRD at the boundary; sanitize strings; reject malformed responses
- [x] 8.3 Persist + surface OGL/CC attribution for SRD-sourced entities
- [x] 8.4 Ensure picker, review panel, and chat buttons use button semantics, are keyboard-operable, and present loading/empty/no-match/error states honoring `prefers-reduced-motion`

## 9. Tests & verification

- [x] 9.1 SRD fallback: Open5e down → dnd5eapi used (mocked `fetch`); circuit-breaker opens after threshold and short-circuits
- [x] 9.2 SRD response is Zod-validated and rejected when malformed
- [x] 9.3 Both sources produce the identical `Proposal` shape and commit through the one `commitProposal` path
- [x] 9.4 No write occurs without explicit confirmation; ownership enforced on propose AND commit (cross-user → 404/not-found)
- [x] 9.5 Committing from the chat widget auto-revalidates the campaign lists (no manual refresh, no duplicates, no missing rows)
- [x] 9.6 Per-user rate limit blocks excess propose calls before any SRD/LLM work
- [x] 9.7 a11y checks on the match picker and review panel (roles, keyboard); chat source-choice buttons are keyboard-operable
- [x] 9.8 Run `npx tsc --noEmit` and the full test suite
