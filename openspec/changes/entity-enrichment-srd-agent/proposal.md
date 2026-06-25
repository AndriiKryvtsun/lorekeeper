## Why

Creating an NPC or Character today is fully manual. Two cheap accelerators already exist in
the codebase but aren't wired to entity creation: the open SRD (a real third-party REST
source) and the LLM (`generateObject`). The goal is to let a user populate a new entity from
EITHER source while preserving the one invariant that makes the assistant safe — a human
confirms before any write. Rather than bolt on a second creation/write path, we extend the
existing human-confirmed proposal/commit pattern (assistant-proposals, "Change 7") so SRD
and agent are simply two SOURCES of the same proposal that converge on one review panel and
one commit path.

## What Changes

- Introduce a unified proposal contract `Proposal { kind: "npc" | "character", source:
  "srd" | "agent", data }`. Both sources produce the SAME Zod-validated `data` shape and
  converge on the SAME editable review panel and the SAME `commitProposal` (re-validate,
  re-check campaign ownership, sanitize, write). **No second write path is added.**
- Add an **SRD capability** on the core API SDK using the shared HTTP transport: Open5e
  (`https://api.open5e.com`) primary, `dnd5eapi.co` fallback — with timeout, idempotent-only
  retry (pure GET), per-provider circuit breaker, and 429/Retry-After handling; base URLs
  from `~/env`. Retrieved SRD data is UNTRUSTED → Zod-validate and map into the NPC/Character
  schema at the boundary. Handle exact-match, multiple-match (pickable list), and no-match
  (quiet fallback to manual entry).
- Add an **agent source** via `generateObject` (LLM port) against the same Zod schema.
- Add two non-streaming tRPC `protectedProcedure`s scoped to campaign ownership:
  `proposeFromSrd(kind, query)` and `proposeFromAgent(kind, prompt)`, each returning the
  unified `Proposal` and each protected by a **per-user rate limit**.
- **Entry point 1 — entity form:** a non-intrusive secondary "Enrich from SRD" action next to
  the name field (enabled when the name has text; manual entry stays primary). It fills the
  SAME form; nothing is written without explicit Apply. SRD offered for NPC (and Character
  only if statblocks are modeled); agent generation for both.
- **Entry point 2 — chat assistant:** classify intent with `claude-haiku-4-5` →
  `srd-likely` / `original` / `ambiguous`. Show two inline source-choice buttons ONLY when
  ambiguous; default sensibly otherwise. Both paths return a proposal and NEVER auto-write.
- **Auto-revalidation (required):** on `commitProposal` success — from EITHER surface and
  EITHER source — invalidate the affected tRPC React Query queries by consistent query keys
  AND revalidate the affected route (`revalidatePath` / `router.refresh`) so the campaign
  view shows the new entity immediately. A commit made inside the floating chat widget MUST
  invalidate the entity lists on the campaign page (shared query client + consistent keys)
  and refresh any RSC-rendered lists — no stale, duplicated, or missing rows.
- Persist `source` and OGL/CC **attribution** on NPC and Character.

Non-goals: no streaming for the propose procedures; no new write path; no auto-write from
either source; no change to the existing grounded Q&A pipeline.

## Capabilities

### New Capabilities

- `entity-enrichment`: the unified two-source enrichment feature — the `Proposal{kind,source,
  data}` contract, the `proposeFromSrd` / `proposeFromAgent` procedures (ownership-scoped,
  rate-limited), both entry points (entity form action + chat source-choice), match handling
  (exact / multiple / none), the single editable review panel, and the cross-surface
  auto-revalidation on commit. Accessible and reduced-motion aware.
- `srd`: the SRD lookup capability built on the api-sdk — one typed port, Open5e-primary /
  dnd5eapi-fallback adapters over the shared HTTP transport (timeout, idempotent retry,
  circuit breaker, 429/Retry-After), base URLs from `~/env`, Zod-validation of untrusted SRD
  responses, mapping into the NPC/Character schema, match semantics, and OGL/CC attribution.

### Modified Capabilities

- `assistant-proposals`: extend the proposal shape with `source` (`"srd" | "agent"`) and a
  `kind` of `"npc" | "character"`; both sources converge on the single `commitProposal`
  (re-validate, re-verify ownership, sanitize, write through the existing owner-scoped data
  layer) — no second write path; the commit audit records the `source`; commit success
  triggers cross-surface auto-revalidation.
- `assistant`: add the chat enrichment entry point — classify create-intent with the cheap
  `classify` tier into `srd-likely` / `original` / `ambiguous`; render inline source-choice
  buttons only when ambiguous; default sensibly otherwise; both paths return a unified
  proposal and NEVER auto-write, flowing into the existing confirm-before-commit UI.
- `campaign-data-model`: NPC and Character persist a `source` and an OGL/CC `attribution`
  field (with a migration).

## Impact

- **Affected specs:** new `entity-enrichment`, new `srd`; modified `assistant-proposals`,
  `assistant`, `campaign-data-model`.
- **Affected code:** new SRD capability under `lib/sdk/capabilities/srd/` + `lib/sdk/server/`
  (env-driven selection, shared `CircuitBreaker`, `request()` transport); new Zod schemas /
  mappers in `lib/validation`; extended proposal validation + `lib/data/proposal.ts` commit;
  new propose procedures + rate limiting (reusing `lib/ai/rate-limit`); the entity form
  (`crud-section` / form field) gains an enrich action; a shared editable review panel + match
  picker; the chat assistant route/UI gains intent classification + source-choice buttons;
  consistent React Query keys + `revalidatePath`/`router.refresh` wiring; Prisma migration
  adding `source` + `attribution` to NPC/Character.
- **Dependencies:** no new packages — reuses the existing `lib/sdk/http` transport, `lib/ai`
  LLM port (`generateObject`, `classify` tier = `claude-haiku-4-5`), Zod, tRPC + React Query.
  New `~/env` keys for SRD base URLs and provider selection.
- **Security:** SRD untrusted → Zod boundary; SRD calls server-side only; ownership enforced
  on BOTH propose and commit; per-user rate limit on propose; no auto-writes; strings
  sanitized; `source` + attribution persisted.
- **Reuses (load-bearing):** this is the first REAL consumer of `lib/sdk/http` (transport +
  circuit breaker + retry + 429 handling), validating that layer in production.
