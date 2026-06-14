## Why

Summarizing a session calls the LLM provider, which is slow and rate-limited — doing it inside
the Session create/update request would block the user and couple writes to provider
availability. Summarization should happen OFF the request path, be retryable and idempotent,
and the result should be auditable and reusable as cheap context for the Q&A assistant.

## What Changes

- On Session create/update, **enqueue** a summary job (a fast DB upsert); the provider is
  **never called inside the request**.
- A **cron-driven worker** (an authenticated `/api/cron` route invoked on a schedule) claims
  pending/failed jobs, calls the assistant provider to summarize the session, and stores the
  **summary plus the model id, provider, and timestamp** on the Session for auditability.
- The job is **idempotent** (one job per session; unchanged content is a no-op via a content
  hash; claimed atomically so concurrent runs don't double-process) and **retries on failure**
  (attempt counter with a max, re-picked on the next tick).
- The stored AI summary is shown **read-only** in the session UI and, because it lives on the
  Session row, automatically becomes **cheap context for Q&A retrieval**.

## Capabilities

### New Capabilities
- `session-summaries`: off-request session summarization — enqueue-on-write, an idempotent,
  retrying cron-driven worker that calls the provider and persists the summary with audit
  metadata, read-only display, and availability as Q&A context.

### Modified Capabilities
- `campaign-data-model`: the `Session` gains AI-summary fields (`aiSummary`,
  `aiSummaryModel`, `aiSummaryProvider`, `aiSummaryAt`, and a source-content hash), and a new
  `SessionSummaryJob` queue table (with RLS) is added.

## Impact

- **Data model**: `Session` summary/audit columns + a `SessionSummaryJob` table (Prisma
  migration; RLS policy scoped via session → campaign → owner). A Prisma-modeled queue is used
  rather than Supabase Queues (pgmq) because the project mandates Prisma-only data access with
  no raw SQL.
- **Write path**: `createSessionForOwner` / `updateSessionForOwner` (and the session tRPC
  mutations) additionally upsert a job — a fast, provider-free operation.
- **Worker**: a new `app/api/cron/summarize-sessions` route (Node runtime), authenticated by a
  `CRON_SECRET`, invoked by a scheduled cron (e.g. Vercel Cron / `vercel.json`). It uses the
  existing `lib/ai` provider via the vendor-neutral port.
- **Assistant**: no code change required — the summary is a Session field already returned by
  the owner-scoped session retrieval, so Q&A picks it up automatically.
- **Env**: add `CRON_SECRET` (server-only).
- **UI**: read-only summary display in the sessions area.
