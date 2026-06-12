## 1. Core (isomorphic): errors, telemetry, types, registry

- [x] 1.1 Add `lib/sdk/core/errors.ts`: `SdkError` base + `TimeoutError`, `RateLimitError`, `UpstreamError`, `CircuitOpenError`, `UnknownProviderError`, `NoProviderConfiguredError` (carry capability/providerId where relevant). Isomorphic — no `server-only`/`~/env`
- [x] 1.2 Add `lib/sdk/core/telemetry.ts`: allow-list-only API (`capability`, `providerId`, `outcome`, `status`, `latencyMs`, error type) + a pluggable sink (default structured console, no-op in tests). No parameter accepts bodies/prompts/PII. Isomorphic
- [x] 1.3 Add `lib/sdk/core/types.ts`: shared port/adapter types and the selection-config shape. Isomorphic
- [x] 1.4 Add `lib/sdk/core/registry.ts`: generic `Registry<TPort>` — `register(id, adapter)`, config-driven `resolve()` (active id from supplied selection config), ordered `callWithFallback(fn)`, clear `UnknownProviderError`/`NoProviderConfiguredError`. Isomorphic — MUST NOT import `server-only` or `~/env`

## 2. HTTP transport (isomorphic)

- [x] 2.1 Add `lib/sdk/http/circuit-breaker.ts`: per-provider state (closed/open/half-open), threshold open, cooldown → half-open, trial success → closed; injectable clock
- [x] 2.2 Add `lib/sdk/http/retry.ts`: exponential backoff + jitter, bounded attempts, retryable-error classification; injectable sleep/clock for deterministic tests
- [x] 2.3 Add `lib/sdk/http/transport.ts`: `request()` with `AbortSignal` timeout → `TimeoutError`; retry ONLY for idempotent/keyed ops; 429 → `RateLimitError` (honor Retry-After on permitted retry); wraps the circuit breaker; emits telemetry per call. Isomorphic (uses global `fetch`/`AbortController`) — no `server-only`/`~/env`

## 3. Fake `ping` reference capability (isomorphic port + server wiring)

- [x] 3.1 Add `PING_PROVIDER` (default "a") and optional `PING_FALLBACK` to `src/env.ts` (server vars)
- [x] 3.2 Add isomorphic `lib/sdk/capabilities/ping/port.ts` (the single typed `PingPort` interface)
- [x] 3.3 Add two isomorphic fake adapters `adapters/fake-a.ts`, `adapters/fake-b.ts` (no real network, no secrets)
- [x] 3.4 Add server-only `lib/sdk/server/ping.ts`: read `~/env` `PING_PROVIDER`/`PING_FALLBACK`, build the registry from the isomorphic port/adapters, expose a typed accessor; `import "server-only"`

## 4. Tests

- [x] 4.1 Registry: selects the active provider; ordered fallback when primary unavailable; clear error on unknown id and on no provider configured
- [x] 4.2 Transport timeout: a hanging request aborts and raises `TimeoutError`
- [x] 4.3 Transport retry/backoff: idempotent op retries with bounded attempts + backoff; non-idempotent op without a key is NOT retried (stubbed fetch + fake timers)
- [x] 4.4 Circuit breaker: opens after threshold (`CircuitOpenError`), recovers after cooldown
- [x] 4.5 Rate limit: 429 surfaces as `RateLimitError`
- [x] 4.6 Telemetry redaction: emitted logs/metrics contain only allow-listed fields — no secrets/prompts/PII
- [x] 4.7 Client-safety boundary: a scan asserts `lib/sdk/core` and `lib/sdk/http` import neither `server-only` nor `~/env` (so they stay client-importable)
- [x] 4.8 Secret isolation: a repo scan asserts the SDK provider env keys are referenced only under `lib/sdk/server`
- [x] 4.9 Ping capability end-to-end: the server registry selects a fake adapter and returns its result (selection + fallback); the isomorphic port/adapters/registry are usable without `~/env`

## 5. Verification

- [x] 5.1 Run `npx tsc --noEmit` and fix any type errors (no `any`)
- [x] 5.2 Run the Vitest suite and confirm all tests pass
- [x] 5.3 Confirm `next build` succeeds (SDK is server-only; nothing leaks to the client)
