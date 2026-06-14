## MODIFIED Requirements

### Requirement: Session belongs to a campaign
The system SHALL persist a `Session` with a unique `id`, a `title`, a `date` stored as a
full `DateTime` (so a time of day can be recorded), an optional user-authored `summary`, and
optional `notes`. The Session SHALL additionally carry optional AI-summary fields — the
generated summary text, the model id, the provider, a generation timestamp, and a hash of the
summarized source content (for idempotency) — distinct from the user-authored `summary`. Each
Session MUST reference exactly one parent `Campaign` and MUST be deleted when its parent
Campaign is deleted.

#### Scenario: Session is linked to its campaign
- **WHEN** a Session is created referencing an existing Campaign `id`
- **THEN** the Session is retrievable as a child of that Campaign

#### Scenario: Deleting a campaign removes its sessions
- **WHEN** a Campaign with Sessions is deleted
- **THEN** all Sessions referencing that Campaign are also deleted

#### Scenario: AI-summary fields are distinct from the user summary
- **WHEN** an AI summary is stored on a Session
- **THEN** it is written to the AI-summary fields (summary text, model id, provider, timestamp, source hash) and does NOT overwrite the user-authored `summary`

## ADDED Requirements

### Requirement: Session summary job queue
The system SHALL persist a `SessionSummaryJob` representing queued summarization work, with at
most one job per session (a unique `sessionId`), a status, an attempt count, the source-content
hash to summarize, and timestamps. A job MUST reference exactly one `Session` and MUST be
deleted when its Session is deleted. The table SHALL be protected by Row-Level Security,
scoped through the session's campaign owner like the other tables.

#### Scenario: One job per session
- **WHEN** a session is enqueued for summarization more than once
- **THEN** a single job row exists for that session (unique on `sessionId`)

#### Scenario: Job is removed with its session
- **WHEN** a Session is deleted
- **THEN** its `SessionSummaryJob` is also deleted

#### Scenario: RLS protects the job table
- **WHEN** the job table is queried under the authenticated role
- **THEN** access is restricted via the session's campaign owner, consistent with the other tables
