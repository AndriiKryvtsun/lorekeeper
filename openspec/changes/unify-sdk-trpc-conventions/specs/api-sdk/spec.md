## MODIFIED Requirements

### Requirement: Redacted per-call telemetry
The SDK SHALL emit, for each provider call, structured logging and a latency/outcome metric
tagged by capability and provider id. Logging MUST be redacted: it MUST NOT contain
secrets, prompts, or PII. The telemetry event MAY carry an optional, non-sensitive `source`
tag (e.g. `sdk` or `trpc`) so the SDK and the internal tRPC layer can share one log/metric
shape; the field is allow-listed like the others, so it adds no sensitive data.

#### Scenario: Each call emits a tagged metric
- **WHEN** a provider call completes (success or failure)
- **THEN** a latency/outcome metric tagged with the capability and provider id is recorded

#### Scenario: Secrets and sensitive content are never logged
- **WHEN** telemetry is emitted for a call whose inputs include secrets, prompts, or PII
- **THEN** none of those values appear in the logs (they are redacted/omitted)

#### Scenario: Telemetry shape is shared via an optional source tag
- **WHEN** a non-SDK layer (e.g. tRPC) records telemetry through the shared helper
- **THEN** it uses the same event shape and may set `source` to identify the origin, with no sensitive fields

## ADDED Requirements

### Requirement: Outbound third-party calls are confined to the SDK
All outbound third-party API calls SHALL go through an SDK capability port/registry so they
inherit the SDK conventions (timeouts, retry, circuit breaker, telemetry, env-injected
secrets). A dependency/boundary test SHALL fail when a raw outbound `fetch`/`axios` to an
external (absolute `http(s)`) URL, or a vendor AI SDK import, appears OUTSIDE `lib/sdk` (and
`lib/ai`, which owns the LLM vendor adapter). Platform infrastructure clients (Supabase,
Prisma, Upstash) are allow-listed as non-capability infrastructure, not outbound capability
calls.

#### Scenario: A planted external fetch fails the boundary test
- **WHEN** a raw `fetch`/`axios` call to an external URL is added outside `lib/sdk`/`lib/ai`
- **THEN** the boundary test fails (CI catches it)

#### Scenario: Vendor AI SDK imports stay confined
- **WHEN** the codebase is scanned for vendor AI SDK imports
- **THEN** they appear only within `lib/ai` (and `lib/sdk`), nowhere else

#### Scenario: Infrastructure clients are allowed
- **WHEN** application code uses the Supabase/Prisma/Upstash platform clients
- **THEN** the boundary test does not flag them (they are allow-listed infrastructure)
