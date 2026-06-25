## ADDED Requirements

### Requirement: SRD lookup capability on the API SDK
The system SHALL define an SRD lookup capability under `lib/sdk/capabilities/srd/` with one
typed port (one interface for the capability, not widened to unrelated APIs). It SHALL
register an Open5e adapter (primary) and a `dnd5eapi.co` adapter (fallback) through the core
`Registry`, with the active provider and ordered fallback derived from `~/env` inside
`lib/sdk/server`. Provider base URLs SHALL come from `~/env`, not be hard-coded in adapters.

#### Scenario: Active provider and fallback come from env
- **WHEN** the SRD capability is resolved on the server
- **THEN** the active provider and ordered fallback are read from `~/env`, and each adapter uses its base URL from `~/env`

#### Scenario: One typed port for the capability
- **WHEN** the SRD capability is defined
- **THEN** it exposes a single typed port and does not reuse or widen another capability's interface

### Requirement: Resilient SRD requests via the shared transport
SRD adapters SHALL perform their lookups through the shared HTTP transport (`lib/sdk/http`)
using pure `GET` requests configured as idempotent, with a request timeout, a per-provider
circuit breaker, and 429/Retry-After handling. When the primary provider is unavailable (its
circuit is open or it fails), the registry SHALL fall back to the next configured provider.

#### Scenario: Timed-out or failing primary falls back
- **WHEN** the primary SRD provider times out or fails (or its circuit is open)
- **THEN** the lookup falls back to the next configured provider and returns its result

#### Scenario: Idempotent GET is retried; rate limits are honored
- **WHEN** an SRD GET fails with a retryable error, or the provider returns 429 with Retry-After
- **THEN** the transport retries the idempotent GET with backoff (honoring Retry-After) within the configured bounds

### Requirement: Untrusted SRD data is validated and mapped at the boundary
Retrieved SRD responses SHALL be treated as UNTRUSTED. Each adapter SHALL Zod-validate the
provider's response and map it into the application's NPC/Character create-schema shape at the
boundary; a response that fails validation SHALL be rejected (never returned as a usable
candidate). Mapped strings SHALL carry no executable/raw-HTML content downstream.

#### Scenario: Malformed SRD response is rejected
- **WHEN** an SRD provider returns a response that does not satisfy the adapter's Zod schema
- **THEN** it is rejected and not returned as a candidate

#### Scenario: Valid response is mapped into the entity schema
- **WHEN** an SRD provider returns a valid response
- **THEN** it is mapped into the NPC/Character create-schema shape used by the proposal

### Requirement: SRD match semantics
The capability SHALL return match results distinguishing an exact single match, multiple
candidates, and no match. No match SHALL be a normal empty result, not an error.

#### Scenario: Results distinguish single, multiple, and none
- **WHEN** a query resolves to exactly one, several, or zero SRD entries
- **THEN** the capability returns a single mapped candidate, a list of candidates, or an empty result respectively (empty is not an error)

### Requirement: Server-only SRD access with attribution
SRD lookups SHALL be performed server-side only, and each mapped candidate SHALL carry its
`source` and the OGL/CC attribution required by the SRD license so it can be persisted with
the entity.

#### Scenario: SRD is fetched only on the server
- **WHEN** the client bundle is built
- **THEN** SRD provider access lives only in server modules and is not bundled to the client

#### Scenario: Attribution accompanies a candidate
- **WHEN** a mapped SRD candidate is returned
- **THEN** it includes its `source` and the OGL/CC attribution to persist alongside the entity
