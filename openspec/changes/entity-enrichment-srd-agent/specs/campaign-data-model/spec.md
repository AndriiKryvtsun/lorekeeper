## MODIFIED Requirements

### Requirement: NPC belongs to a campaign
The system SHALL persist an `NPC` with a unique `id`, a `name`, an optional `role`, an
optional `description`, and a `status`. The NPC SHALL additionally carry an optional
provenance: a nullable `source` (`"srd" | "agent"`, null for manual entry) and a nullable
`attribution` string holding the OGL/CC notice required when the entity originates from the
SRD. Each NPC MUST reference exactly one parent `Campaign` and MUST be deleted when its
parent Campaign is deleted.

#### Scenario: NPC is linked to its campaign
- **WHEN** an NPC is created referencing an existing Campaign `id`
- **THEN** the NPC is retrievable as a child of that Campaign

#### Scenario: Deleting a campaign removes its NPCs
- **WHEN** a Campaign with NPCs is deleted
- **THEN** all NPCs referencing that Campaign are also deleted

#### Scenario: Manually created NPC has null provenance
- **WHEN** an NPC is created by manual entry
- **THEN** its `source` and `attribution` are null

#### Scenario: SRD-sourced NPC records source and attribution
- **WHEN** an NPC is committed from the SRD source
- **THEN** its `source` is `"srd"` and its `attribution` holds the OGL/CC notice

### Requirement: Character belongs to a campaign
The system SHALL persist a `Character` (a player character) with a unique `id`, a
`name`, a `playerName`, a `class`, an integer `level`, and optional `notes`. The Character
SHALL additionally carry an optional provenance: a nullable `source` (`"srd" | "agent"`, null
for manual entry) and a nullable `attribution` string holding the OGL/CC notice required when
the entity originates from the SRD. Each Character MUST reference exactly one parent
`Campaign` and MUST be deleted when its parent Campaign is deleted.

#### Scenario: Character is linked to its campaign
- **WHEN** a Character is created referencing an existing Campaign `id`
- **THEN** the Character is retrievable as a child of that Campaign

#### Scenario: Manually created Character has null provenance
- **WHEN** a Character is created by manual entry
- **THEN** its `source` and `attribution` are null

#### Scenario: Agent-sourced Character records its source
- **WHEN** a Character is committed from the agent source
- **THEN** its `source` is `"agent"`
