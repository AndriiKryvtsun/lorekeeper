## Why

LoreKeeper will soon call external providers (starting with an LLM for the assistant, and
later others). Without a shared layer, each integration would re-implement provider
selection, timeouts/retries, circuit breaking, and logging — inconsistently, and with a
real risk of leaking secrets or PII into logs. This change adds a reusable internal API
SDK that standardizes provider switching, resilience, and observability for ALL outbound
integrations, so each capability only writes its own typed interface and adapters.

## What Changes

- Add `lib/sdk/` split into an **isomorphic** framework (client- and server-importable) and
  a **server-only** secret boundary:
  - **Core registry** (`lib/sdk/core`, isomorphic): a generic `Registry<TPort>` to register
    named adapters for a capability, resolve the active provider from caller-supplied
    selection config, support an ordered fallback list, and throw a clear error on an
    unknown/missing provider. The core is env-agnostic — it never reads `~/env` or secrets.
  - **Resilient HTTP transport** (`lib/sdk/http`, isomorphic) for capabilities that call
    plain REST: `AbortSignal` timeouts; retry with exponential backoff + jitter limited to
    idempotent/safe operations (or those carrying an idempotency key); a per-provider
    circuit breaker; rate-limit handling; and a typed error hierarchy (`TimeoutError`,
    `RateLimitError`, `UpstreamError`, `CircuitOpenError`, …).
  - **Per-call telemetry** (`lib/sdk/core`, isomorphic): structured, REDACTED logging plus
    a latency/outcome metric tagged by capability and provider id. Never logs secrets,
    prompts, or PII (redaction is structural — the API accepts only allow-listed fields).
  - **Server secret boundary** (`lib/sdk/server`, server-only): the ONLY place that reads
    `~/env` provider configuration/secrets and assembles registries with secret-bearing
    adapters. Marked `import "server-only"`.
- The isomorphic layer is safe to import from Client Components and contains no secrets and
  no `~/env` access. Secret/config injection comes from `~/env` ONLY and ONLY within
  `lib/sdk/server`; no file outside `lib/sdk/server` reads a provider secret directly.
- Switching the active provider is a change to `~/env` (server) or to client-supplied
  selection config — never to caller code.
- Deliver ONE fake reference capability — a trivial `ping` port with two fake adapters
  (isomorphic) plus its server-side env-wired assembly — to prove the pattern on both
  sides. No real third-party adapters are added in this change.

### Design rules (enforced in spec + tests)
- Exactly ONE typed PORT per capability — unrelated APIs are never collapsed into a single
  interface. The SDK supplies shared machinery; each capability keeps its own interface.
- An adapter MAY use the shared HTTP transport OR supply its own (e.g. a future LLM
  capability wrapping a vendor SDK that owns its transport).
- Switching the active provider is a change to `~/env`, never to caller code.

## Capabilities

### New Capabilities
- `api-sdk`: The internal outbound-integration SDK — an isomorphic generic provider
  registry with selection and fallback, the isomorphic resilient HTTP transport (timeouts,
  jittered retry on safe ops, circuit breaker, rate-limit handling, typed errors), redacted
  per-call telemetry, the isomorphic-core/server-only-secret split and secret-isolation
  rules, the one-port-per-capability rule, and a fake `ping` reference capability proving
  the pattern on client and server.

### Modified Capabilities
<!-- None. Additive infrastructure; existing capabilities' requirements are unchanged.
     The SDK consumes `~/env` (typed-env) but does not change its requirements. -->

## Impact

- **New isomorphic code (client- and server-importable, no secrets/env)**:
  `lib/sdk/core/` (registry, telemetry, errors, types), `lib/sdk/http/` (transport, circuit
  breaker, retry/backoff), and `lib/sdk/capabilities/ping/` (port + two fake adapters).
- **New server-only code**: `lib/sdk/server/` — reads `~/env` and assembles the ping
  registry from `PING_PROVIDER`/`PING_FALLBACK`; the only place provider secrets/config are
  injected. `import "server-only"`.
- **Config**: `~/env` (`src/env.ts`) gains optional `PING_PROVIDER`/`PING_FALLBACK`
  variables, consumed only inside `lib/sdk/server`.
- **Dependencies**: none required (uses global `fetch`/`AbortController`).
- **Tests**: registry selection / fallback / unknown-provider error; transport
  timeout/retry/backoff and circuit-breaker behavior against stubbed fetch; telemetry
  redaction; a static assertion that provider secrets/`~/env` are read only inside
  `lib/sdk/server`; and a boundary assertion that `lib/sdk/core` and `lib/sdk/http` import
  neither `server-only` nor `~/env` (so they stay client-safe).
- No data-model, API-route, or UI changes; no real external calls.
