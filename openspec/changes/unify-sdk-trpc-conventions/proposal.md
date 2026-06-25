## Why

The SDK (`lib/sdk`) already gives outbound calls one set of conventions — timeouts, retry,
circuit breaker, redacted telemetry, typed errors, and env-injected secrets — but nothing
enforces that ALL outbound third-party calls go through it, and the internal tRPC layer does
not yet share those conventions. We want one convention set across both layers WITHOUT wrapping
tRPC in the SDK (which would forfeit end-to-end type inference and React Query).

## What Changes

- **Outbound (SDK is the only door):** audit for any third-party call that bypasses `lib/sdk`
  (raw `fetch`/`axios` to an external URL, or a vendor/AI-SDK import outside `lib/ai`/`lib/sdk`)
  and route each through an SDK capability port/registry so it inherits the SDK conventions. Add
  a **dependency/boundary test** that fails CI when an outbound `fetch`/`axios` to an external
  URL, or a vendor AI SDK import, appears outside `lib/sdk` (and `lib/ai` for the LLM adapter).
- **Internal (tRPC keeps its identity, gains the conventions via LINKS):** keep tRPC as the
  client↔server layer (RSC server caller + React Query hooks). Apply the same cross-cutting
  conventions through tRPC **links**, not by wrapping calls:
  - an **error-formatting link** that maps server errors to the SDK's isomorphic typed-error
    hierarchy;
  - a **telemetry link** that emits the SAME redacted structured-log + latency/outcome shape as
    the SDK, tagged `source=trpc`;
  - a conservative **retry link** that retries only safe/idempotent operations (queries).
- Reuse the SDK's **isomorphic core** (typed errors + telemetry helpers — the secret-free part)
  so both layers share one convention set. Add an optional `source` tag to the telemetry event.
- Do NOT route tRPC through the SDK registry or HTTP transport. The streaming `/api/assistant`
  route stays as-is.

## Capabilities

### New Capabilities
<!-- None — this strengthens/extends two existing capabilities. -->

### Modified Capabilities
- `api-sdk`: add an enforced boundary that outbound third-party calls are confined to the SDK
  (dependency/boundary test); extend the telemetry event with an optional `source` tag so the
  SDK and tRPC share one log/metric shape.
- `trpc-api`: apply the SDK's cross-cutting conventions to the client transport via links
  (typed-error mapping, redacted telemetry tagged `source=trpc`, idempotent-only retry), reusing
  the SDK isomorphic core — without routing tRPC through the SDK registry/transport and without
  changing type inference or React Query behavior.

## Impact

- **Code (outbound):** a new boundary test (extending `lib/sdk/sdk-boundaries.test.ts` or a
  sibling) that scans for external `fetch`/`axios` and vendor AI SDK imports outside the allowed
  dirs. Audit confirms current outbound calls already route through `lib/sdk` (ping ref) and
  `lib/ai` (LLM); platform infra clients (Supabase, Prisma, Upstash) are allow-listed as
  non-capability infrastructure.
- **Code (internal):** new tRPC links under `src/trpc/links/` (error-map, telemetry, retry)
  wired into `~/trpc/react`; a small extension to `lib/sdk/core/telemetry.ts` (`source` field).
  A few components that branch on `error.data?.code` migrate to the shared typed errors.
- **Unchanged:** the SDK registry/HTTP transport are not used by tRPC; end-to-end type inference
  and React Query lifecycle (caching, states) are preserved; `/api/assistant` streaming is
  untouched; no new dependency.
