# api-sdk Specification

## Purpose

The api-sdk capability provides the shared, provider-agnostic machinery for calling external
APIs: one typed port per capability, a config-driven provider registry with ordered fallback,
a resilient HTTP transport (timeouts, idempotent retries, per-provider circuit breaker,
rate-limit handling), a typed error hierarchy, and redacted per-call telemetry. Its core and
HTTP layers are isomorphic and client-safe, while provider secrets are confined to a
server-only boundary that reads configuration exclusively from `~/env`.

## Requirements

### Requirement: One typed port per capability
The SDK SHALL define exactly one typed PORT (interface) per capability; unrelated provider
APIs MUST NOT be collapsed into a single shared interface. The SDK provides shared
machinery (registry, transport, telemetry) while each capability keeps its own interface
and adapter implementations.

#### Scenario: A capability declares its own port
- **WHEN** a new capability is added to the SDK
- **THEN** it defines its own typed port interface rather than reusing or widening another capability's interface

### Requirement: Provider registry with config-driven selection
The SDK SHALL provide a generic `Registry<TPort>` allowing named adapters to be registered
for a capability. The active provider SHALL be chosen from selection config supplied to the
registry (the active id and an ordered fallback list), not hard-coded in caller code. On the
server, that selection config is derived from `~/env` within `lib/sdk/server`; on the client
it is supplied from client-safe configuration. The registry returns the adapter for the
configured provider id.

#### Scenario: Active provider is selected from config
- **WHEN** the selection config names a registered provider as active for a capability
- **THEN** the registry returns that provider's adapter

#### Scenario: Switching provider does not change caller code
- **WHEN** the active-provider selection changes to another registered provider (server: via `~/env`)
- **THEN** callers receive the new adapter with no change to caller code

### Requirement: Ordered fallback list
The registry SHALL support an ordered fallback list so that, when the primary provider is
unavailable (e.g. its circuit is open or it fails), the next configured provider is used.

#### Scenario: Falls back to the next provider
- **WHEN** the primary provider is unavailable and a fallback provider is configured
- **THEN** the registry/caller resolves to the next provider in order

### Requirement: Clear error on unknown or missing provider
The registry SHALL throw a clear, typed error when a selected provider id is not registered
or when no provider is configured for a capability.

#### Scenario: Unknown provider id
- **WHEN** the active provider id does not match any registered adapter
- **THEN** a clear error naming the capability and the unknown id is thrown

#### Scenario: No provider configured
- **WHEN** no active provider is configured for a capability
- **THEN** a clear error is thrown rather than silently returning undefined

### Requirement: Resilient HTTP transport
The SDK SHALL provide a shared HTTP transport (`lib/sdk/http`) for capabilities that call
plain REST, offering: `AbortSignal`-based timeouts; retry with exponential backoff plus
jitter; a per-provider circuit breaker; and rate-limit handling. Adapters MAY use this
transport OR supply their own (e.g. a vendor SDK that owns its transport).

#### Scenario: Request times out
- **WHEN** a request exceeds the configured timeout
- **THEN** the transport aborts it and raises a `TimeoutError`

#### Scenario: An adapter may bypass the shared transport
- **WHEN** an adapter wraps a vendor SDK that manages its own networking
- **THEN** it implements the port without using the shared HTTP transport, and still registers normally

### Requirement: Retry limited to safe or idempotent operations
The transport SHALL retry only operations that are safe/idempotent or that carry an
idempotency key. Non-idempotent operations without an idempotency key MUST NOT be retried.
Retries SHALL use exponential backoff with jitter and a bounded maximum attempt count.

#### Scenario: Idempotent operation is retried with backoff
- **WHEN** a safe/idempotent request fails with a retryable error
- **THEN** the transport retries up to the limit using exponential backoff with jitter

#### Scenario: Non-idempotent operation is not retried
- **WHEN** a non-idempotent request without an idempotency key fails
- **THEN** the transport does not retry and surfaces the error

### Requirement: Per-provider circuit breaker
The transport SHALL maintain a per-provider circuit breaker that opens after a threshold of
failures, short-circuits calls with a `CircuitOpenError` while open, and recovers (half-open
→ closed) after a cooldown.

#### Scenario: Circuit opens after repeated failures
- **WHEN** a provider exceeds the failure threshold
- **THEN** subsequent calls fail fast with `CircuitOpenError` until the cooldown elapses

#### Scenario: Circuit recovers after cooldown
- **WHEN** the cooldown elapses and a trial call succeeds
- **THEN** the circuit closes and normal calls resume

### Requirement: Rate-limit handling
The transport SHALL detect upstream rate limiting (e.g. HTTP 429) and surface it as a
`RateLimitError`, honoring a retry-after hint when present for any permitted retry.

#### Scenario: Upstream returns 429
- **WHEN** a provider responds with a rate-limit status
- **THEN** the transport raises a `RateLimitError` (respecting retry-after when retrying a safe op)

### Requirement: Typed error hierarchy
The SDK SHALL expose a typed error hierarchy including at least `TimeoutError`,
`RateLimitError`, `UpstreamError`, and `CircuitOpenError`, so callers can branch on error
type rather than parsing messages.

#### Scenario: Errors are distinguishable by type
- **WHEN** a transport failure occurs
- **THEN** the raised error is an instance of the specific typed error for that failure mode

### Requirement: Redacted per-call telemetry
The SDK SHALL emit, for each provider call, structured logging and a latency/outcome metric
tagged by capability and provider id. Logging MUST be redacted: it MUST NOT contain
secrets, prompts, or PII.

#### Scenario: Each call emits a tagged metric
- **WHEN** a provider call completes (success or failure)
- **THEN** a latency/outcome metric tagged with the capability and provider id is recorded

#### Scenario: Secrets and sensitive content are never logged
- **WHEN** telemetry is emitted for a call whose inputs include secrets, prompts, or PII
- **THEN** none of those values appear in the logs (they are redacted/omitted)

### Requirement: Isomorphic core is client-safe
The framework layers `lib/sdk/core` and `lib/sdk/http` SHALL be isomorphic — importable from
both Client and Server Components. They MUST NOT import `server-only`, MUST NOT read `~/env`,
and MUST NOT reference any provider secret. The registry resolves the active provider from
caller-supplied selection config, not by reading env itself.

#### Scenario: Core/http are importable from the client
- **WHEN** a Client Component imports from `lib/sdk/core` or `lib/sdk/http`
- **THEN** the import succeeds and the client bundle builds with no secret included

#### Scenario: Core/http never read env or secrets
- **WHEN** `lib/sdk/core` and `lib/sdk/http` are scanned
- **THEN** they import neither `server-only` nor `~/env` and reference no provider secret

### Requirement: Server-only secret boundary
Provider configuration and secrets SHALL be injected from `~/env` ONLY, and ONLY within
`lib/sdk/server`, which SHALL be server-only (`import "server-only"`). No file outside
`lib/sdk/server` SHALL read a provider secret directly.

#### Scenario: Secret boundary is server-only
- **WHEN** a client bundle is built
- **THEN** `lib/sdk/server` modules and provider secrets do not appear in it

#### Scenario: Provider secrets are read only inside the server boundary
- **WHEN** the codebase is scanned for provider-secret / `~/env` provider access
- **THEN** such access occurs only within `lib/sdk/server`, nowhere else

### Requirement: Fake reference capability
The SDK SHALL include one fake reference capability — a trivial `ping` port with two fake
adapters — to demonstrate the pattern. No real third-party adapters are included in this
change.

#### Scenario: Ping capability resolves and responds via the registry
- **WHEN** the `ping` capability is invoked with a configured fake provider
- **THEN** the registry selects the fake adapter and returns its ping result, exercising selection/fallback without any real network call
