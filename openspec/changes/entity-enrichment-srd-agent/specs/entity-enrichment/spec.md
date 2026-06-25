## ADDED Requirements

### Requirement: Unified two-source proposal contract
The system SHALL represent entity enrichment as a single proposal shape `Proposal { kind:
"npc" | "character", source: "srd" | "agent", data }`, where `data` is validated against the
SAME Zod create-schema the entity's tRPC mutation uses. The SRD source and the agent source
SHALL produce the IDENTICAL validated `data` shape and SHALL converge on the SAME editable
review panel and the SAME commit path. There SHALL be no second write path for enriched
entities.

#### Scenario: Both sources produce the same proposal shape
- **WHEN** a proposal is produced from the SRD source and another from the agent source for the same `kind`
- **THEN** both have the shape `{ kind, source, data }` with `data` validated against the same create-schema, differing only in `source`

#### Scenario: Both sources commit through the one path
- **WHEN** a proposal from either source is committed
- **THEN** it is written through the single existing `commitProposal` path, not a source-specific writer

### Requirement: Ownership-scoped, rate-limited propose procedures
The system SHALL expose two non-streaming `protectedProcedure`s — `proposeFromSrd(kind,
query)` and `proposeFromAgent(kind, prompt)` — that verify the caller owns the target
campaign (returning 404 on mismatch, existence not revealed), enforce a per-user rate limit
before doing any SRD/LLM work, and return the unified `Proposal`. Neither procedure SHALL
write to the database.

#### Scenario: Anonymous or cross-user propose is rejected
- **WHEN** an unauthenticated user, or a user who does not own the target campaign, calls a propose procedure
- **THEN** the call is rejected (unauthorized / 404) and no SRD or LLM work is performed

#### Scenario: Per-user rate limit blocks excess propose calls
- **WHEN** a user exceeds the per-user propose rate limit
- **THEN** further propose calls are blocked until the window resets, before any SRD lookup or model call

#### Scenario: Propose performs no write
- **WHEN** either propose procedure returns a proposal
- **THEN** no campaign entity has been created or modified

### Requirement: Entity-form enrichment entry point
The entity creation form SHALL offer a non-intrusive secondary "Enrich from SRD" action
adjacent to the name field, enabled only when the name field has text; manual entry SHALL
remain the primary path. Applying an enrichment SHALL fill the SAME form fields, and nothing
SHALL be written until the user explicitly applies/saves. The SRD action SHALL be offered for
NPC (and for Character only if statblocks are modeled); agent generation SHALL be offered for
both.

#### Scenario: Enrich action is secondary and gated on name text
- **WHEN** the entity form renders with an empty name versus a name containing text
- **THEN** the "Enrich from SRD" action is disabled when empty and enabled when the name has text, with manual entry remaining the primary affordance

#### Scenario: Enrichment fills the same form without writing
- **WHEN** the user applies an enrichment result in the form
- **THEN** the form fields are populated and no entity is written until the user explicitly saves

### Requirement: Match handling for SRD lookups
An SRD enrichment SHALL handle three outcomes: an exact match SHALL populate the proposal
directly; multiple matches SHALL present an accessible list for the user to pick one; and no
match SHALL fall back quietly to manual entry without raising an error.

#### Scenario: Exact match populates directly
- **WHEN** an SRD lookup yields a single exact match
- **THEN** its mapped data populates the review panel / form directly

#### Scenario: Multiple matches present a picker
- **WHEN** an SRD lookup yields multiple candidates
- **THEN** an accessible list is shown for the user to choose one before a proposal is formed

#### Scenario: No match falls back to manual entry
- **WHEN** an SRD lookup yields no match
- **THEN** the UI quietly falls back to manual entry with no error state blocking the user

### Requirement: Single editable review before commit
Regardless of source or surface, a proposal SHALL be presented in an editable review panel
with explicit Apply and Cancel actions; the user MAY edit the fields before applying. No
write SHALL occur unless the user explicitly applies, and the applied (possibly edited) data
SHALL be the data that is committed and re-validated.

#### Scenario: Edited values are what get committed
- **WHEN** the user edits fields in the review panel and applies
- **THEN** the edited values are committed and re-validated, not the original source output

#### Scenario: Cancel discards without writing
- **WHEN** the user cancels the review
- **THEN** the proposal is discarded and no write occurs

### Requirement: Cross-surface auto-revalidation on commit
The system SHALL, on a successful commit from either surface (entity form or chat widget) and
either source, invalidate the affected tRPC React Query queries via consistent query keys and
revalidate the affected route (`revalidatePath` / `router.refresh`), so the campaign view
reflects the new entity immediately. A commit performed inside the floating chat widget SHALL
invalidate the entity lists rendered on the campaign page (shared query client and consistent
keys) and refresh any RSC-rendered lists, with no stale, duplicated, or missing rows.

#### Scenario: Commit from the form refreshes the lists
- **WHEN** an entity is committed from the entity form
- **THEN** the affected query keys are invalidated and the route revalidated so the new row appears without a manual refresh

#### Scenario: Commit from the chat widget refreshes the campaign lists
- **WHEN** an entity is committed inside the floating chat widget
- **THEN** the campaign page's entity lists are invalidated by consistent keys and any RSC list is refreshed, showing the new row with no duplicates or stale data

### Requirement: Accessible enrichment UI and states
The match-list picker, the editable review panel, and the chat source-choice buttons SHALL
use correct semantics (real buttons, labelled controls) and be fully keyboard-operable. The
enrichment surfaces SHALL present loading, empty, no-match, and error states, and SHALL
respect `prefers-reduced-motion`.

#### Scenario: Controls are keyboard-operable with correct semantics
- **WHEN** a keyboard user operates the picker, the review panel, or the chat source-choice buttons
- **THEN** each control is a real button/labelled input, reachable and operable by keyboard

#### Scenario: States are surfaced accessibly
- **WHEN** an enrichment is loading, returns nothing, finds no match, or errors
- **THEN** the corresponding loading/empty/no-match/error state is shown with accessible markup, honoring reduced-motion
