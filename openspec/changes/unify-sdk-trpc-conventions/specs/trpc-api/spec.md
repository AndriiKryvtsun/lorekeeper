## ADDED Requirements

### Requirement: Shared cross-cutting conventions via tRPC links
The tRPC client transport SHALL apply the SDK's cross-cutting conventions through tRPC LINKS,
reusing the SDK's isomorphic core (typed errors + telemetry helpers — the secret-free part),
WITHOUT routing tRPC through the SDK registry or HTTP transport and WITHOUT changing end-to-end
type inference or React Query behavior. There SHALL be:
- an error-formatting link that maps server/transport errors to the SDK's typed-error hierarchy;
- a telemetry link that emits the same redacted structured-log + latency/outcome shape as the
  SDK, tagged `source=trpc` (no prompts/PII/secrets);
- a retry link that retries ONLY safe/idempotent operations (queries), never mutations,
  using the SDK's backoff.

The streaming `/api/assistant` route SHALL remain unaffected.

#### Scenario: A tRPC error surfaces as the shared typed error
- **WHEN** a procedure call fails (e.g. NOT_FOUND, a 5xx, or a network error)
- **THEN** the error reaching the caller is an instance of the SDK's typed-error hierarchy

#### Scenario: Telemetry uses the shared shape tagged source=trpc
- **WHEN** a tRPC operation completes (success or failure)
- **THEN** a redacted latency/outcome event is recorded in the SDK's telemetry shape with `source=trpc` and no sensitive fields

#### Scenario: Retry applies only to idempotent queries
- **WHEN** a retryable failure occurs for a query versus a mutation
- **THEN** the query is retried with backoff and the mutation is NOT retried

#### Scenario: Type inference and React Query behavior are unchanged
- **WHEN** a Client Component uses the typed hooks within the provider
- **THEN** end-to-end input/output inference and React Query lifecycle (caching, states) behave exactly as before

#### Scenario: tRPC is not routed through the SDK registry/transport
- **WHEN** the tRPC links run
- **THEN** they reuse only the SDK's isomorphic core (typed errors + telemetry), not the SDK registry or HTTP transport
