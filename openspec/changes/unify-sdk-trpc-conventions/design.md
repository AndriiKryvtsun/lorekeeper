## Context

`lib/sdk` has an isomorphic core (`core/errors.ts` typed errors, `core/telemetry.ts`
`recordTelemetry` + `TelemetryEvent`, `http/retry.ts` `isRetryableError`/`backoffDelay`) and a
server boundary (`server/`) for secrets. Existing boundary tests: `lib/sdk/sdk-boundaries.test.ts`
(core/http isomorphic + secret isolation) and `lib/ai/ai-boundaries.test.ts` (vendor AI SDK
confined to `lib/ai`). tRPC: `~/trpc/react` (client, `httpBatchLink` + superjson) and
`~/trpc/server` (RSC `createCaller`). The server `initTRPC` already has an `errorFormatter` that
surfaces `zodError`. No raw external `fetch`/`axios` exists in app code today; outbound goes
through `lib/sdk` (ping ref) and `lib/ai` (LLM). Supabase/Prisma/Upstash are platform clients.

## Goals / Non-Goals

**Goals:**
- One enforced door for outbound third-party calls (SDK), guarded by a boundary test.
- tRPC gains the SDK's conventions (typed errors, redacted telemetry, idempotent retry) via
  LINKS, reusing the SDK isomorphic core — type inference and React Query behavior unchanged.

**Non-Goals:**
- Do NOT route tRPC through the SDK registry/HTTP transport.
- Do NOT wrap tRPC calls; no change to `/api/assistant` streaming.
- Not adding axios or any new dependency.

## Decisions

### 1. Telemetry shares one shape via an optional `source` tag
Add `source?: string` to `TelemetryEvent` (isomorphic, allow-listed — still no body/secret
fields). SDK adapters omit it (origin implied) or set `"sdk"`; the tRPC telemetry link sets
`"trpc"`, with `capability` = the operation path and `providerId = "trpc"`. One log line shape
(`kind: "sdk.call"`) across both layers. Rationale: minimal core change, single sink/format.

### 2. Three client links, ordered so each sees the right thing
Client chain (outer→inner): `telemetryLink → retryLink → errorMapLink → httpBatchLink`.
- `errorMapLink` (closest to transport) maps the `TRPCClientError` to an SDK typed error.
- `retryLink` therefore sees SDK errors and reuses `isRetryableError`/`backoffDelay`; it retries
  ONLY `op.type === "query"`.
- `telemetryLink` (outermost) measures end-to-end latency (including retries) and records the
  shared event on settle/error.
Links are implemented with `@trpc/client`'s observable `TRPCLink` — no wrapping of call sites.
Rationale: ordering lets retry classify via SDK errors and telemetry capture the true outcome.

### 3. Error mapping preserves the original tRPC data (non-breaking)
`errorMapLink` maps by `error.data?.httpStatus`/`code`: 408/`TIMEOUT` → `TimeoutError`;
429/`TOO_MANY_REQUESTS` → `RateLimitError`; ≥500 → `UpstreamError{status}`; other 4xx (incl.
`NOT_FOUND`, `BAD_REQUEST`) → `UpstreamError{status}`; network failure (no data) → `TimeoutError`
or `UpstreamError`. The original `TRPCClientError` is preserved as the SDK error's `cause`, and a
helper `trpcErrorData(err)` reads `code`/`zodError` from it. Rationale: callers get a typed error
AND existing data (e.g. zod field errors, NOT_FOUND code) stays reachable, so React Query and
forms keep working. The few components that branch on `error.data?.code` (e.g. the proposal card)
migrate to `instanceof` + `status` (or `trpcErrorData`). Alternative considered: replace the
error outright (rejected — would drop `zodError` and break inline form validation).

### 4. Boundary test: external fetch/axios + vendor AI SDK
Add a boundary test that scans app source and fails when: (a) `axios` is imported anywhere
outside `lib/sdk`; (b) a raw `fetch(` to an absolute external URL literal (`"http…`/`` `http… ``)
appears outside `lib/sdk`/`lib/ai`; (c) a vendor AI SDK import (`ai`, `@ai-sdk/anthropic|openai|
groq`) appears outside `lib/ai`/`lib/sdk` (reaffirming `ai-boundaries`). Relative `fetch("/api/…")`
is allowed (internal). Supabase/Prisma/Upstash imports are explicitly NOT flagged. Rationale:
catches regressions in CI without false-positives on internal/infra calls.

### 5. Links are client-transport only; the RSC caller stays a direct typed call
tRPC links apply to the client (HTTP) chain. The RSC `createCaller` invokes procedures directly
(no link chain) — we do NOT wrap it. Server-side error typing already comes from procedures +
the `initTRPC` `errorFormatter`; telemetry on the RSC path (no network) is out of scope here. A
server telemetry MIDDLEWARE could later cover both paths, but the instruction is "via links," so
that's a noted non-goal.

## Risks / Trade-offs

- **Error mapping breaking form validation** → mitigated by preserving the original error as
  `cause` and exposing `trpcErrorData`; forms read `zodError` via that. Covered by tests.
- **Retry on non-idempotent ops** → the retry link gates strictly on `op.type === "query"`;
  mutations are never retried. Tested both ways.
- **Telemetry double-counting with retries** → telemetry is outermost and records once per
  operation (final outcome), not per attempt.
- **Boundary-test false positives/negatives** → scope to absolute-URL literals + explicit
  allow-list; document what is and isn't covered so the guard stays trustworthy.
- **observable link bugs** → keep links thin and unit-test each with a stubbed `next`/op.

## Open Questions

- Whether to later add a server telemetry middleware so RSC-caller calls emit the shared shape
  too (out of scope now per the "links" instruction).
