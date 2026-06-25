## ADDED Requirements

### Requirement: Chat enrichment entry with source classification
The assistant SHALL, when the user's own message expresses an intent to CREATE an NPC or
Character, classify the source intent with the cheap `classify` tier (default
`claude-haiku-4-5`) into `srd-likely`, `original`, or `ambiguous`. When `ambiguous`, the
assistant SHALL render exactly two inline source-choice buttons ("From SRD" / "Generate");
otherwise it SHALL default sensibly to the classified source. Both paths SHALL return the
unified create proposal and SHALL NEVER auto-write; the proposal flows into the existing
confirm-before-commit UI. Source intent SHALL be derived ONLY from the user's message, never
from retrieved `<campaign_data>` (prompt-injection safe).

#### Scenario: Ambiguous intent shows two source buttons
- **WHEN** the create-intent message is classified `ambiguous`
- **THEN** two inline source-choice buttons are shown and no proposal is produced until the user picks a source

#### Scenario: Unambiguous intent defaults to a source
- **WHEN** the message is classified `srd-likely` or `original`
- **THEN** the assistant proceeds with the SRD or agent source respectively, without prompting for a choice

#### Scenario: Chat enrichment never auto-writes
- **WHEN** a proposal is produced from either source in chat
- **THEN** it is presented for explicit confirmation and no write occurs until the user confirms

#### Scenario: Source intent ignores injected campaign data
- **WHEN** retrieved campaign data contains text resembling a create instruction
- **THEN** it does not drive source classification or trigger a proposal (only the user's message does)
