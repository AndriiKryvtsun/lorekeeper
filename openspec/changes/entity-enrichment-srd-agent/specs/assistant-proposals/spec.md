## ADDED Requirements

### Requirement: Source-tagged create proposals converge on one commit
The system SHALL allow a `create` proposal for an NPC or Character to carry a `source` of
`"srd"` or `"agent"` in addition to the existing action/entity/fields. Both sources SHALL
produce `fields` validated against the SAME existing create-schema, and both SHALL be
committed through the SINGLE existing `commitProposal` path, which re-validates the fields,
re-verifies campaign ownership, and sanitizes input before writing through the owner-scoped
data layer. No source-specific or second write path SHALL be introduced.

#### Scenario: SRD and agent proposals commit identically
- **WHEN** a create proposal sourced from SRD and one sourced from the agent are confirmed for an owned campaign
- **THEN** both are committed via the same `commitProposal` (re-validate, re-verify ownership, sanitize, write), differing only in the persisted `source`/attribution

#### Scenario: Ownership is re-verified at commit regardless of source
- **WHEN** a source-tagged proposal targets a campaign the user does not own
- **THEN** the commit returns not-found and no write occurs

#### Scenario: Fields are re-validated at commit regardless of source
- **WHEN** a source-tagged proposal is confirmed
- **THEN** its fields are re-validated against the existing create-schema before any write, and invalid input is rejected

### Requirement: Commit persists and audits the proposal source
On a confirmed commit of a source-tagged proposal, the system SHALL persist the `source` and,
for SRD-sourced entities, the OGL/CC attribution on the created entity. The commit audit
record SHALL include the `source` alongside the existing fields (user, campaign, action,
entity, outcome), with no prompt text, PII, or secrets.

#### Scenario: Source and attribution are persisted
- **WHEN** an SRD-sourced create commits
- **THEN** the created entity stores its `source` and OGL/CC attribution

#### Scenario: Audit captures the source
- **WHEN** a source-tagged commit completes (success or failure)
- **THEN** the redacted audit record includes the `source` without storing prompt text, PII, or secrets
