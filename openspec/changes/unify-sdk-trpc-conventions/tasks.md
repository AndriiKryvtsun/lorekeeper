## 1. Shared telemetry shape

- [ ] 1.1 Add an optional, allow-listed `source?: string` to `TelemetryEvent` in `lib/sdk/core/telemetry.ts` (still no body/secret fields); keep the default sink line shape (`kind: "sdk.call"`)

## 2. Outbound boundary

- [ ] 2.1 Audit app source for outbound calls bypassing the SDK (raw `fetch`/`axios` to external URLs; vendor AI SDK imports outside `lib/ai`/`lib/sdk`); route any finding through an SDK port (none expected — confirm/record)
- [ ] 2.2 Add a boundary test that FAILS when: `axios` is imported outside `lib/sdk`; a raw `fetch(` to an absolute external URL literal appears outside `lib/sdk`/`lib/ai`; or a vendor AI SDK import appears outside `lib/ai`/`lib/sdk`. Allow relative `fetch("/…")` and the Supabase/Prisma/Upstash platform clients

## 3. tRPC links (client transport)

- [ ] 3.1 Add `src/trpc/links/error-map.ts`: an `errorMapLink` mapping `TRPCClientError` → SDK typed error by `httpStatus`/`code` (408/TIMEOUT→TimeoutError; 429→RateLimitError; ≥500→UpstreamError; other 4xx→UpstreamError{status}; network→Timeout/Upstream), preserving the original error as `cause`; export a `trpcErrorData(err)` helper to read `code`/`zodError`
- [ ] 3.2 Add `src/trpc/links/telemetry.ts`: a `telemetryLink` that records one redacted `recordTelemetry` event per operation (latency + outcome, `capability` = op path, `providerId = "trpc"`, `source = "trpc"`); no prompts/PII/secrets
- [ ] 3.3 Add `src/trpc/links/retry.ts`: a `retryLink` that retries ONLY `op.type === "query"` on `isRetryableError`, using `backoffDelay`, with a small attempt cap; mutations never retried
- [ ] 3.4 Wire the links into `~/trpc/react` in order `telemetry → retry → errorMap → httpBatchLink`; reuse ONLY the SDK isomorphic core (no SDK registry/transport); leave superjson + type inference intact

## 4. Component migration

- [ ] 4.1 Migrate components that branch on `error.data?.code` (e.g. the assistant proposal card) to the shared typed errors (`instanceof` + `status`); forms reading `zodError` read it via `trpcErrorData(err.cause)` so inline validation is preserved

## 5. Tests

- [ ] 5.1 Boundary: a planted raw external `fetch` (and an `axios` import) outside `lib/sdk` fails the boundary test; relative fetch + infra clients pass
- [ ] 5.2 Error-map link: a NOT_FOUND, a 5xx, and a network error each surface as the matching SDK typed error, with the original tRPC data reachable via `cause`/`trpcErrorData`
- [ ] 5.3 Telemetry link: a completed operation emits the shared event shape with `source="trpc"` and no sensitive fields (assert via a stubbed telemetry sink)
- [ ] 5.4 Retry link: a retryable query is retried with backoff; a retryable mutation is NOT retried
- [ ] 5.5 Type/behavior: end-to-end input/output inference compiles unchanged and React Query lifecycle (success/error/caching) is unaffected

## 6. Verification

- [ ] 6.1 Run `npx tsc --noEmit` and fix any type errors (no `any`)
- [ ] 6.2 Run the Vitest suite (node + jsdom) and confirm all tests pass
- [ ] 6.3 Confirm `next build` succeeds; tRPC is not routed through the SDK registry/transport; `/api/assistant` streaming unchanged
