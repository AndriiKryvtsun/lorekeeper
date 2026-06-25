## Context

The codebase already has the three pieces this feature composes:
- A human-confirmed proposal/commit pattern (`lib/validation/assistant-proposal.ts` +
  `lib/data/proposal.ts`): `parseProposal` is the single validation boundary and
  `commitProposal` is the single owner-scoped writer. The model is never in the commit path.
- A resilient HTTP transport (`lib/sdk/http`: `request()`, `CircuitBreaker`, retry, 429) and a
  config-driven `Registry` with ordered fallback — currently exercised only by the fake `ping`
  capability. This change makes the SRD capability its FIRST real consumer.
- A vendor-neutral LLM port (`lib/ai`) exposing `generateObject<T>(schema)` and tiered
  accessors (`getProvider("classify")` → `claude-haiku-4-5`, `"answer"` → sonnet).

The existing `Proposal` is action-centric (`create | update | delete` × five entities). The
requested enrichment contract is `Proposal { kind: "npc" | "character", source: "srd" |
"agent", data }`. The central design problem is reconciling these WITHOUT adding a second
write path.

## Goals / Non-Goals

**Goals:**
- One proposal, two sources (SRD, agent), two surfaces (entity form, chat) — converging on one
  editable review and one commit.
- SRD as a real `lib/sdk` capability over the shared transport (Open5e primary, dnd5eapi
  fallback), with untrusted responses Zod-validated and mapped at the boundary.
- Cross-surface auto-revalidation so a commit (even from the floating chat widget) immediately
  refreshes campaign lists with no stale/duplicate/missing rows.
- Ownership enforced on propose AND commit; per-user rate limit on propose; no auto-writes.

**Non-Goals:**
- No streaming for the propose procedures.
- No second/parallel write path; no change to the grounded Q&A pipeline.
- No SRD for player Characters unless statblocks are modeled (see Decisions) — agent covers
  Character.

## Decisions

### Map `{kind, source, data}` onto a source-tagged create proposal (one write path)
The enrichment contract is implemented as the EXISTING create proposal plus a `source` tag:
`kind` ↔ `entity` (`"npc" | "character"`), `data` ↔ `fields` (validated by the same
create-schema). `proposalEnvelopeSchema` gains an optional `source: z.enum(["srd","agent"])`
and `parseProposal` threads it through for `action: "create"`. `commitProposal` persists
`source` (+ attribution) but is otherwise unchanged — still the single re-validate/own/sanitize/
write path.
- _Alternative:_ a separate `EnrichmentProposal` type + writer. Rejected — it is exactly the
  "second write path" the proposal forbids and would duplicate ownership/validation logic.

### SRD capability mirrors the `ping` reference, over the real transport
New `lib/sdk/capabilities/srd/`: one `SrdPort` (`lookup(kind, query) → SrdCandidate[]`), with
`adapters/open5e.ts` and `adapters/dnd5eapi.ts`. Each adapter calls `request(url, {method:
"GET"}, {capability:"srd", providerId}, {timeoutMs, idempotent:true, circuit})`, Zod-validates
the response, and maps it into the entity create-schema shape (+ `source`, OGL/CC
`attribution`). `lib/sdk/server/srd.ts` (`import "server-only"`) reads selection + base URLs
from `~/env`, holds one shared `CircuitBreaker`, and exposes `lookupSrd` via
`registry.callWithFallback`. Match arity (0/1/many) is derived from the candidate count.
- _Alternative:_ fetch SRD directly in a tRPC procedure. Rejected — loses timeout/retry/breaker/
  fallback and the env-driven provider swap; the transport already encodes this correctly.

### New env keys (defaults to public URLs)
Add to `~/env` server block: `SRD_PROVIDER` (default `"open5e"`), `SRD_FALLBACK` (default
`"dnd5eapi"`), `OPEN5E_BASE_URL` (default `https://api.open5e.com`), `DND5EAPI_BASE_URL`
(default `https://www.dnd5eapi.co/api`). Read only inside `lib/sdk/server`.

### Two non-streaming tRPC propose procedures, ownership + rate-limited
A new `enrichmentRouter` exposes `proposeFromSrd(kind, campaignId, query)` and
`proposeFromAgent(kind, campaignId, prompt)` as `protectedProcedure`s. Each verifies campaign
ownership via the existing owner-scoped data layer (404 on mismatch), enforces a per-user
limit BEFORE any SRD/LLM work, and returns the unified proposal. Rate limiting reuses the
Upstash setup in `lib/ai/rate-limit.ts` with a dedicated `enrich:user` prefix (disabled when
Upstash is unconfigured, like the assistant).
- `proposeFromAgent` generates via the LLM port's text `generate()` (prompted for a JSON object
  of the entity's fields), extracts the JSON, and validates it against the SAME create-schema
  the mutation uses; `proposeFromSrd` calls `lookupSrd`. Both return `{ kind, source, data }`
  (or, for SRD, a candidate list when arity > 1). Text generate + Zod-validate is used in place
  of `generateObject` so the path is provider-portable — some providers/models (e.g. Groq) do
  not support a `json_schema` response format, and the existing proposal pipeline already uses
  this text+validate approach for the same reason. Validation still enforces the create-schema
  (defaults applied, `level` coerced, invalid output rejected).

### Chat intent classification with the cheap tier
On a create-intent message, classify source with `getProvider("classify")` (haiku) into
`srd-likely | original | ambiguous` via the port's text `generate()` (one-word answer parsed
into the enum, provider-portable like `proposeFromAgent`), derived ONLY from the user message. `ambiguous` → render two inline source-choice buttons; otherwise default
to the classified source. Both paths produce the unified proposal and reuse the existing
confirm-before-commit card — never auto-writing.

### Auto-revalidation: shared query client + consistent keys + route revalidation
The whole app already mounts one `TRPCReactProvider` at the root, so the chat widget and the
campaign page share ONE React Query client. Commit is invoked through a thin Server Action that
wraps `commitProposal` and calls `revalidatePath` for the campaign route; on success the client
calls `utils.<entityList>.invalidate()` (consistent, path-derived keys) and `router.refresh()`.
This covers both client-cached lists (invalidate) and RSC-rendered lists (revalidatePath +
refresh), from either surface, with no duplicate rows.
- _Alternative:_ optimistic insert into the cache. Rejected for v1 — risk of duplicates when the
  refetch lands; invalidate+refresh is simpler and correct.

### SRD applies to NPCs; agent applies to both
Open5e/dnd5eapi expose monsters/creatures, not player characters. SRD enrichment is offered for
NPC; Character enrichment uses the agent source. (If Character statblocks are later modeled, the
same `SrdPort` extends to it — see Open Questions.)

## Risks / Trade-offs

- **Untrusted SRD data** → Zod-validate every provider response at the adapter boundary; reject
  malformed; map to the create-schema; sanitize strings; never render raw HTML.
- **Stale/duplicate rows across surfaces** → single shared query client, consistent path-derived
  keys, `revalidatePath` + `router.refresh`; covered by a chat-commit-refreshes-campaign test.
- **Provider outage / latency** → shared transport timeout + circuit breaker + ordered fallback;
  no-match and provider failure both degrade gracefully (quiet fallback to manual entry).
- **Rate-limit disabled in dev** → mirrors the assistant; production MUST configure Upstash.
- **License compliance** → persist + display OGL/CC `attribution` for SRD-sourced entities.
- **Injection via chat** → source intent derived only from the user message, never from
  `<campaign_data>`, consistent with the existing proposal-path rule.

## Migration Plan

Add nullable `source` and `attribution` columns to `NPC` and `Character` via a Prisma migration
(existing rows backfill to null; no RLS change — child policies already key on the campaign
owner). Ship the SRD capability, env keys, propose procedures, UI entry points, and revalidation
together. Rollback is a straightforward revert plus a down migration dropping the two columns;
no existing write path changes.

## Open Questions

- Should player-Character statblocks be modeled so SRD can populate Characters too? Default for
  this change: no (agent covers Character). Does not block the contract.
- Final per-user propose rate-limit numbers (start conservative, align with assistant limits).
