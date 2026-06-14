## Context

Sessions are created/updated through `lib/data/sessions.ts` (owner-scoped) and the session
tRPC router. The Q&A assistant already retrieves a campaign's sessions via
`listSessionsForOwner`, so any field stored on the Session row is automatically available as
grounding context. The LLM provider is reached only through the vendor-neutral `lib/ai` port.
Project rules: Prisma is the ONLY data-access layer (no raw SQL), every change has tests, and
input is validated at the boundary.

## Goals / Non-Goals

**Goals:**
- Summarization happens off the user request path, idempotently, with retries and audit
  metadata, and the result is reusable as Q&A context.

**Non-Goals:**
- No realtime/streaming summaries; eventual consistency is fine.
- No backfill UI; existing sessions get summarized on their next write or by the worker sweep.
- No change to how Q&A retrieval works beyond the new field riding along.

## Decisions

### 1. Prisma-modeled job queue + cron-driven worker (not Supabase Queues)
A `SessionSummaryJob` table (one row per session, unique `sessionId`) is the queue, and an
authenticated `/api/cron/summarize-sessions` route is the worker, invoked on a schedule
(Vercel Cron via `vercel.json`). Rationale: the project mandates Prisma-only data access with
NO raw SQL, but Supabase Queues (pgmq) requires raw SQL/RPC (`pgmq.send`/`pgmq.read`) to
enqueue and consume — so a Prisma table modeled as a queue is the compliant, testable choice.
Alternative considered: pgmq (rejected — violates the no-raw-SQL rule and adds an extension to
manage).

### 2. Enqueue inside the session write, provider-free
`createSessionForOwner` / `updateSessionForOwner` upsert the job (by `sessionId`) in the SAME
transaction as the write, storing a `sourceHash` of the summarizable content. No provider call
occurs in the request — enqueue is a fast DB op. Rationale: atomic with the write and provably
synchronous-summarization-free (the data layer does not import the provider).

### 3. Idempotency via unique session + content hash + atomic claim
Three layers: (a) unique `sessionId` so re-enqueuing upserts rather than duplicates; (b) a
`sourceHash` of `title|date|summary|notes` — the worker skips (no provider call) when the
session's stored `aiSummarySourceHash` already equals the job's hash; (c) the worker claims a
batch by transitioning `status` `pending → processing` guarded on the current status, so a
concurrent run can't grab the same job. Rationale: re-running the worker and rapid re-edits are
both safe.

### 4. Retry with attempt cap
On failure the worker increments `attempts` and sets the job back to `pending` (or `failed`
once `attempts >= MAX`), recording `lastError`. Eligible jobs are re-picked next tick. The
session's prior summary is never corrupted on failure. Rationale: transient provider/rate-limit
errors self-heal; permanent failures are visible and bounded.

### 5. Worker auth + runtime
The route is `runtime = "nodejs"` (Prisma pg adapter) and requires the configured `CRON_SECRET`
(checked from the `Authorization: Bearer …` header Vercel Cron sends). Unauthenticated callers
get 401. Summarization uses the existing `getProvider` (answer tier) `generate()`; the session
content is passed as data (not instructions). Stored: `aiSummary`, `aiSummaryModel`,
`aiSummaryProvider`, `aiSummaryAt`, `aiSummarySourceHash`.

### 6. Q&A context is automatic
Because `aiSummary` is a column on `Session` and `listSessionsForOwner` returns Session rows,
the assistant's existing retrieval includes it with no assistant-side change.

## Risks / Trade-offs

- **`updateMany` can't LIMIT** → claim by selecting N pending ids then `updateMany where id in
  ids and status = 'pending'` (the status guard preserves atomicity); process the claimed set.
- **Cron auth spoofing** → require the secret on every call; never expose it client-side; the
  route does no work without it.
- **Worker is technically an HTTP route** → but it is a scheduled, secret-gated endpoint, not a
  user request; the user-facing create/update path remains provider-free (the tested guarantee).
- **Stuck `processing` jobs (worker crash mid-run)** → treat `processing` older than a timeout
  as reclaimable on a later run (or reset via the attempt sweep), so jobs don't wedge.
- **RLS on the new table** → add a policy scoped through `session → campaign.ownerId`, matching
  the other tables; the worker uses the server (service-role) client.

## Open Questions

- Summary model/tier: default to the `answer` tier; could use a cheaper tier later via env.
- Cron cadence is a deployment choice (e.g. every few minutes); set in `vercel.json`.
