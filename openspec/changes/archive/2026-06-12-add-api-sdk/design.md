## Context

LoreKeeper reads all configuration through the typed `~/env` module and keeps secrets
server-only. It currently has no outbound third-party integrations, but several are coming
(an LLM for the assistant first). To avoid each integration re-implementing provider
selection, resilience, and logging — and to prevent secret/PII leakage — this change adds a
reusable, server-only internal SDK under `lib/sdk/`. It ships the framework plus one fake
`ping` capability as a reference; no real adapters. Project rules: strict TypeScript (no
`any`), `~/env` is the only env reader, server-only secrets, tests with every change.

## Goals / Non-Goals

**Goals:**
- An **isomorphic** framework (`lib/sdk/core` + `lib/sdk/http`) safe to import from Client
  and Server Components, containing no secrets and no `~/env` access.
- A generic `Registry<TPort>` with config-driven active-provider selection, ordered
  fallback, and clear unknown/missing-provider errors.
- A resilient HTTP transport: timeouts, jittered exponential backoff retry limited to
  safe/idempotent ops, per-provider circuit breaker, rate-limit handling, typed errors.
- Redacted per-call telemetry (structured log + latency/outcome metric) tagged by
  capability + provider id; never logs secrets/prompts/PII.
- A **server-only secret boundary** (`lib/sdk/server`): the only place reading `~/env`
  provider config/secrets; no provider-secret access outside it.
- One fake `ping` capability with two fake adapters (isomorphic) plus its server-side
  env-wired assembly, proving the pattern on both sides.

**Non-Goals:**
- Any real third-party adapter (LLM or otherwise) — a later change.
- A metrics backend; telemetry emits through a small sink (default console/no-op).
- Distributed/shared circuit-breaker state — in-process is sufficient here.
- Changing `~/env`'s contract beyond adding the ping selection vars.

## Decisions

- **Two-layer split: isomorphic framework + server-only secret boundary.** `lib/sdk/core`
  and `lib/sdk/http` are isomorphic (no `import "server-only"`, no `~/env`, no secrets) and
  importable from Client Components. `lib/sdk/server` is the only server-only module; it
  reads `~/env` and assembles registries with secret-bearing adapters. This makes the
  framework client-available without ever exposing a secret. Boundary is enforced by a
  test that scans `core`/`http` for forbidden imports (`server-only`, `~/env`).
- **Registry is generic and env-agnostic.** `Registry<TPort>` knows only about ids →
  adapters and a resolution order; selection config (active id + fallback list) is passed
  in. On the server it comes from `~/env` (inside `lib/sdk/server`); on the client from
  client-safe config. Keeps the core pure/unit-testable and makes "switch provider = config
  change" true. Alternative: registry reads env directly — rejected (couples core to env,
  breaks client-safety and testability).
- **One port per capability.** Ports live at `lib/sdk/capabilities/<name>/port.ts`
  (isomorphic). The core never defines a cross-capability "mega interface". The `ping`
  capability is the template: isomorphic `port.ts`, `adapters/fake-a.ts`,
  `adapters/fake-b.ts`; and `lib/sdk/server/ping.ts` builds the registry from `~/env`
  selection and exposes a typed server accessor. A client could instead build a registry
  from the same isomorphic port/adapters with client-safe config.
- **Directory layout.**
  - `lib/sdk/core/` — `errors.ts`, `telemetry.ts`, `registry.ts`, `types.ts` (isomorphic)
  - `lib/sdk/http/` — `circuit-breaker.ts`, `retry.ts`, `transport.ts` (isomorphic)
  - `lib/sdk/capabilities/ping/` — `port.ts`, `adapters/fake-a.ts`, `adapters/fake-b.ts` (isomorphic)
  - `lib/sdk/server/` — `ping.ts` / `index.ts` (server-only `~/env` wiring + secret adapters)
- **Resolution + fallback.** `resolve()` returns the active adapter; a higher-level
  `callWithFallback(fn)` tries active then fallbacks in order, skipping providers whose
  circuit is open or that throw a retryable/availability error, and rethrows the last error
  if all fail. Adapters that bring their own transport still participate.
- **HTTP transport contract.** `request(input, opts)` where `opts` carries `capability`,
  `providerId`, `timeoutMs`, `retry` policy, and an idempotency signal
  (`idempotent: true` or `idempotencyKey`). It uses `fetch` + `AbortController` for
  timeouts. Retries ONLY when the op is idempotent/keyed AND the error is retryable
  (network, 5xx, 429); backoff = `base * 2^attempt` plus random jitter, capped, bounded
  attempts. 429 → `RateLimitError` honoring `Retry-After` on a permitted retry.
- **Per-provider circuit breaker.** A keyed in-process map of `{ state, failures,
  openedAt }`. Opens after a failure threshold; while open, calls fail fast with
  `CircuitOpenError`; after a cooldown it goes half-open and a trial success closes it.
  Keyed by `providerId` so one bad provider doesn't trip others.
- **Telemetry redaction by allow-list.** The telemetry API accepts ONLY safe fields
  (`capability`, `providerId`, `outcome`, `status`, `latencyMs`, error *type*). It has no
  parameter for request/response bodies, prompts, or args — so sensitive data cannot be
  passed in, making redaction structural rather than best-effort. A pluggable sink defaults
  to a structured `console` line (and a no-op in tests). Alternative: log full
  request/response and scrub — rejected (fragile, leak-prone).
- **Typed errors.** `SdkError` base with subclasses `TimeoutError`, `RateLimitError`,
  `UpstreamError`, `CircuitOpenError`, `UnknownProviderError`, `NoProviderConfiguredError`;
  each carries `capability`/`providerId` where relevant.
- **Server-only secret boundary + isolation.** Only `lib/sdk/server` modules do `import
  "server-only"` and read `~/env`. The isomorphic `core`/`http`/`capabilities` layers do
  neither. Two tests enforce this: (1) a boundary scan that `core`/`http` import neither
  `server-only` nor `~/env`; (2) a secret-isolation scan that the SDK's provider env keys
  are referenced only under `lib/sdk/server`. Vitest already aliases `server-only` to a
  no-op for unit tests, so importing the server layer in tests still works.
- **Env additions.** `src/env.ts` gains `PING_PROVIDER` (default `"a"`) and
  `PING_FALLBACK` (optional, comma-separated) as server vars — consumed only inside
  `lib/sdk/server`.
- **No new dependencies.** Uses global `fetch`/`AbortController`. Transport tests stub
  `fetch` and use fake timers; circuit/retry timing is deterministic. (Date/random are
  normal Node runtime here — no workflow-sandbox restriction.)

## Risks / Trade-offs

- **Timing-based tests (backoff/circuit cooldown) flakiness** → use Vitest fake timers and
  injectable `now()`/`sleep` (or a clock) so tests are deterministic, not wall-clock bound.
- **Telemetry allow-list too strict** → if a future capability needs more context, extend
  the allow-list with non-sensitive fields only; never add a free-form body field.
- **In-process circuit breaker** → state resets on cold start / isn't shared across
  instances; acceptable for now, documented; revisit if we need shared state.
- **"No secret outside lib/sdk" enforced by scan** → the scan is heuristic (env-key names);
  paired with `server-only` and the env allow-list it is sufficient for this stage.
- **Fallback masking real failures** → `callWithFallback` records telemetry per attempt and
  rethrows the final typed error, so failures remain observable.

## Migration Plan

1. Add isomorphic `lib/sdk/core` (`errors.ts`, `telemetry.ts`, `registry.ts`, `types.ts`) —
   no `server-only`, no `~/env`.
2. Add isomorphic `lib/sdk/http` (`circuit-breaker.ts`, `retry.ts`, `transport.ts`).
3. Add the isomorphic `ping` capability (`port.ts`, two fake adapters), then
   `lib/sdk/server/ping.ts` (server-only) that reads `PING_PROVIDER`/`PING_FALLBACK` from
   `~/env` and builds the registry; add the env vars to `src/env.ts`.
4. Add tests: registry selection/fallback/unknown-provider; transport
   timeout/retry/backoff/circuit-breaker against stubbed fetch; telemetry redaction; the
   client-safety boundary scan (core/http import no `server-only`/`~/env`); the
   secret-isolation scan (env keys only under `lib/sdk/server`).
5. Run `npx tsc --noEmit`, the suite, and `next build`.
- **Rollback:** remove `lib/sdk` and the ping env vars; nothing else depends on it yet.

## Open Questions

- Telemetry sink wiring (where structured lines ultimately go) is left as a default
  console/no-op until an observability backend is chosen.
