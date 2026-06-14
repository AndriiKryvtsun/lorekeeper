# session-summaries

## Purpose

Defines off-request, idempotent AI summarization of campaign sessions: jobs are
enqueued on session writes and processed by a scheduled worker that calls the
assistant provider through the vendor-neutral port, stores the summary with audit
metadata, retries on failure, and exposes the summary read-only in the UI and as
Q&A grounding context.

## Requirements

### Requirement: Enqueue on session write, never summarize in-request
On Session create and update, the system SHALL enqueue a summary job and SHALL NOT call the
LLM provider during the HTTP request. Enqueuing SHALL be a fast database operation that does
not depend on provider availability.

#### Scenario: Creating or updating a session enqueues a job
- **WHEN** a session is created or updated
- **THEN** a summary job for that session is enqueued

#### Scenario: No synchronous summarization in a request
- **WHEN** a session create/update request is handled
- **THEN** the LLM provider is NOT called within that request, and the request completes without waiting on summarization

### Requirement: Off-request worker generates and stores the summary with audit metadata
A scheduled, authenticated worker (not a user request path) SHALL process enqueued jobs by
calling the assistant provider through the vendor-neutral port to summarize the session, and
SHALL store on the Session the summary text together with the model id, provider, and a
generation timestamp. The worker route SHALL reject unauthenticated/unscheduled callers.

#### Scenario: Worker summarizes and persists audit metadata
- **WHEN** the worker processes a pending job
- **THEN** it calls the provider, and stores the summary plus the model id, provider, and timestamp on the Session

#### Scenario: Worker endpoint is protected
- **WHEN** the worker route is called without the configured cron secret
- **THEN** the request is rejected and no summarization occurs

### Requirement: Idempotent jobs
Summarization SHALL be idempotent. There SHALL be at most one job per session; re-enqueuing
SHALL NOT create duplicates. The worker SHALL skip work when the session content is unchanged
since the last summary (compared via a content hash), and SHALL claim a job atomically so
concurrent worker runs do not process the same job twice.

#### Scenario: Re-enqueue does not duplicate
- **WHEN** a session is updated multiple times before the worker runs
- **THEN** there is still a single job for that session

#### Scenario: Unchanged content is a no-op
- **WHEN** the worker runs for a session whose summarized content has not changed since the last summary
- **THEN** it does not call the provider again and the stored summary is unchanged

#### Scenario: Re-running the worker is safe
- **WHEN** the worker runs again over already-summarized sessions
- **THEN** no duplicate or conflicting writes occur

### Requirement: Retry on failure
When summarization fails, the job SHALL be retried on a later worker run, tracking an attempt
count, up to a maximum after which it is marked failed (and surfaced for inspection). A failure
SHALL NOT lose the job or corrupt the session.

#### Scenario: Transient failure is retried
- **WHEN** a summarization attempt fails
- **THEN** the job remains eligible and is retried on a subsequent worker run, with its attempt count incremented

#### Scenario: Exhausted retries are marked failed
- **WHEN** a job reaches the maximum attempts without success
- **THEN** it is marked failed and not retried further, leaving the session's prior summary intact

### Requirement: Read-only summary in the session UI
The stored AI summary SHALL be displayed read-only in the session UI; users SHALL NOT edit it
through the summary display (it is generated, not user-authored).

#### Scenario: Summary shown read-only
- **WHEN** a session with a stored AI summary is viewed
- **THEN** the summary is shown read-only

### Requirement: Summaries available as Q&A context
The stored AI summary SHALL be part of the session record returned by the owner-scoped
retrieval used by the Q&A assistant, so it is available as grounding context.

#### Scenario: Summary is included in retrieved session data
- **WHEN** the assistant retrieves a campaign's sessions
- **THEN** each session's stored AI summary is included in the retrieved data
