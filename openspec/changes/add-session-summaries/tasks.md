## 1. Data model & migration

- [x] 1.1 Add AI-summary fields to `Session` in `prisma/schema.prisma`: `aiSummary String?`, `aiSummaryModel String?`, `aiSummaryProvider String?`, `aiSummaryAt DateTime?`, `aiSummarySourceHash String?` (distinct from the user-authored `summary`)
- [x] 1.2 Add a `SessionSummaryJob` model: `id`, unique `sessionId`, `status` (pending|processing|done|failed), `attempts Int @default(0)`, `sourceHash`, `lastError String?`, `createdAt`/`updatedAt`, relation to `Session` with `onDelete: Cascade`, index on `status`
- [x] 1.3 Create the Prisma migration; add a Row-Level Security policy for `SessionSummaryJob` scoped via `session → campaign.ownerId` (consistent with the other tables)

## 2. Env & validation

- [x] 2.1 Add server-only `CRON_SECRET` to `src/env.ts` (and `.env.example`)
- [x] 2.2 Add a `computeSummarySourceHash(session)` helper over `title|date|summary|notes` (shared by enqueue and worker)

## 3. Enqueue on write (provider-free)

- [x] 3.1 In `createSessionForOwner` / `updateSessionForOwner`, upsert a `SessionSummaryJob` by `sessionId` (status `pending`, current `sourceHash`) in the SAME transaction as the write — no provider call in the request
- [x] 3.2 Keep the data layer free of any `lib/ai` provider import on the write path (synchronous-summarization guard)

## 4. Off-request worker

- [x] 4.1 Add `lib/summaries/worker.ts` `processPendingSummaries(limit)`: claim a batch of `pending` jobs (`attempts < MAX`) atomically (select ids → `updateMany` to `processing` guarded on status); for each, load the session, and SKIP (mark done, no provider call) when `session.aiSummarySourceHash === job.sourceHash` (idempotent no-op)
- [x] 4.2 For changed content, summarize via the `lib/ai` port (`getProvider("answer").generate`, session content passed as data), then store `aiSummary`, `aiSummaryModel`, `aiSummaryProvider`, `aiSummaryAt`, `aiSummarySourceHash` and mark the job `done`
- [x] 4.3 On failure, increment `attempts`, record `lastError`, set back to `pending` (or `failed` at `MAX`); never corrupt the session's prior summary
- [x] 4.4 Add `app/api/cron/summarize-sessions/route.ts` (`runtime = "nodejs"`): reject calls without the `CRON_SECRET` (401), else run `processPendingSummaries`; return a small JSON status

## 5. Deployment & UI

- [x] 5.1 Add a scheduled cron for the worker route (e.g. `vercel.json` `crons`)
- [x] 5.2 Show the AI summary read-only in the sessions UI (with model/provider/timestamp as audit detail); not editable through the summary display
- [x] 5.3 Confirm Q&A retrieval includes the summary (it rides along on the Session row via `listSessionsForOwner`) — no assistant code change

## 6. Tests

- [x] 6.1 Enqueue: creating and updating a session upserts a single job (idempotent on `sessionId`) and the provider is NEVER called during the write (synchronous-summarization guard)
- [x] 6.2 Worker idempotency: unchanged `sourceHash` is a no-op (no provider call, summary unchanged); re-running over done sessions makes no conflicting writes
- [x] 6.3 Worker success: a changed session is summarized and the summary + model + provider + timestamp are stored, and the job is marked done
- [x] 6.4 Retry: a provider failure increments `attempts` and re-queues; at `MAX` the job is `failed` and the session's prior summary is intact
- [x] 6.5 Worker auth: the cron route rejects requests without `CRON_SECRET` (401) and does no summarization

## 7. Verification

- [x] 7.1 Run `npx tsc --noEmit` and fix any type errors (no `any`)
- [x] 7.2 Run the Vitest suite (node + jsdom) and confirm all tests pass
- [x] 7.3 Confirm `next build` succeeds; the worker route is Node-runtime and secret-gated; no vendor SDK escapes `lib/ai`; the write path performs no synchronous summarization
