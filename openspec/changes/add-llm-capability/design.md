## Context

Change 4b shipped `lib/sdk` — an isomorphic core (`Registry`, telemetry, typed errors) plus
a server-only secret boundary — with a fake `ping` capability as the only consumer. CLAUDE.md
requires that the app depend on our own provider PORT (not Anthropic/OpenAI/the AI SDK
directly) and that nothing outside `lib/ai/` import a vendor SDK; API keys are server-only.
`~/env` is the single env reader. This change builds the LLM capability as the first real SDK
consumer, wrapping the Vercel AI SDK inside `lib/ai/` adapters behind a vendor-neutral port.

## Goals / Non-Goals

**Goals:**
- A vendor-neutral `LlmProvider` port (`generate`, `stream`, `generateObject<T>`) with
  domain-only types (messages, system, `maxOutputTokens`, `temperature`, `AbortSignal`) +
  token usage in every result.
- Anthropic and OpenAI adapters wrapping the Vercel AI SDK, registered through the SDK
  `Registry`, selected/fell-back via `~/env`.
- Reused telemetry + typed errors; server-only; provider keys only inside `lib/ai` via `~/env`.
- Vendor/AI-SDK imports confined to adapter files; an eval set for provider switches.

**Non-Goals:**
- The assistant feature / any UI or route that consumes the port (later change).
- Tool calling, multi-turn agent loops, prompt caching tuning (the port stays minimal here).
- Using the shared REST transport for LLM (the AI SDK owns transport, by design).
- Embedding/vision endpoints.

## Decisions

- **Wrap the Vercel AI SDK (v5), not the Anthropic SDK directly.** Per the spec, each adapter
  calls the AI SDK's `generateText` / `streamText` / `generateObject` from `ai`, with models
  from `@ai-sdk/anthropic` and `@ai-sdk/openai`. This is the deliberate "adapter brings its
  own transport" path the `api-sdk` spec allows. The app still depends only on our
  `LlmProvider` port — the AI SDK is an implementation detail of two files.
- **Provider clients built from `~/env`, not ambient `process.env`.** Adapters construct
  clients with the AI SDK factories — `createAnthropic({ apiKey: env.ANTHROPIC_API_KEY })`,
  `createOpenAI({ apiKey: env.OPENAI_API_KEY })` — so the key comes through the typed env and
  no module reads `process.env` for keys. Keeps the single-env-reader rule intact.
- **`LlmProvider` port shape.**
  ```
  type LlmMessage = { role: "system" | "user" | "assistant"; content: string }
  type LlmCallOptions = { messages: LlmMessage[]; system?: string;
    maxOutputTokens?: number; temperature?: number; signal?: AbortSignal }
  type LlmUsage = { inputTokens: number; outputTokens: number }
  interface LlmProvider {
    generate(opts): Promise<{ text: string; usage: LlmUsage }>
    stream(opts): Promise<{ textStream: AsyncIterable<string>; usage: Promise<LlmUsage> }>
    generateObject<T>(opts & { schema: ZodType<T> }): Promise<{ object: T; usage: LlmUsage }>
  }
  ```
  Vendor-neutral; `generateObject` takes a Zod schema and the AI SDK validates the output.
- **Temperature is conditional on Anthropic.** Opus 4.7 / 4.8 / Fable 5 reject `temperature`
  (400). The Anthropic adapter therefore omits `temperature` for models that don't accept it
  (the current default `claude-opus-4-8` among them) and only forwards it for models that do;
  the OpenAI adapter forwards it normally. `temperature` stays optional in the port so callers
  needn't know provider rules.
- **Default model `claude-opus-4-8`.** `AI_PROVIDER` defaults to `anthropic` and `AI_MODEL`
  to `claude-opus-4-8` (the most capable current model; per the Claude API guidance, not
  downgraded). Both are env-driven, so swapping to Sonnet/Haiku or OpenAI is an `~/env` edit.
- **Registry wiring in `lib/ai/index.ts`.** Build `new Registry<LlmProvider>("llm")`,
  register `"anthropic"` and `"openai"` adapter instances (each closes over its `AI_MODEL`),
  and resolve via a `SelectionConfig` derived from `AI_PROVIDER` + `AI_FALLBACK`. A small
  `llm()` accessor returns the active provider (or uses `callWithFallback` for resilience).
- **Telemetry + typed-error mapping.** Each adapter call is wrapped to record SDK telemetry
  (`capability: "llm"`, `providerId`, latency, outcome — never prompt/PII), and to translate
  AI SDK errors into the SDK's typed errors (rate-limit → `RateLimitError`, abort/timeout →
  `TimeoutError`, others → `UpstreamError`). A shared helper keeps both adapters consistent.
- **Server-only + import isolation.** Every `lib/ai` entry module does `import "server-only"`.
  A repo-scan test asserts that imports of `ai` / `@ai-sdk/*` / provider SDKs appear only
  under `lib/ai/`. A second scan asserts `ANTHROPIC_API_KEY`/`OPENAI_API_KEY` are referenced
  only under `lib/ai` and `src/env.ts`.
- **Eval set.** `lib/ai/eval/` holds a few representative prompts (a factual Q, a
  format-following task, a structured-output case) and a runner that calls them through the
  port against the active provider. Used manually when switching providers; not part of the
  unit suite (it needs real keys/network).
- **Testing without network.** A `FakeLlmProvider` implementing the port returns canned text/
  usage. Registry tests assert env-driven selection, fallback, and unknown-provider errors
  using the fake. The vendor-import and key-isolation tests are static repo scans (no network).

## Risks / Trade-offs

- **`temperature` on Anthropic reasoning models** → silently dropping it could surprise a
  caller expecting it to apply; mitigated by documenting the rule in the adapter and keeping
  `temperature` optional. If the AI SDK already filters it per model, the guard is harmless.
- **AI SDK v5 surface drift** → pin known-good versions; isolate the surface to two adapter
  files behind the port so churn doesn't leak app-wide.
- **Streaming + usage** → the AI SDK exposes usage as a promise that resolves after the stream
  drains; the port models this (`usage: Promise<LlmUsage>`), so callers await it post-stream.
- **Key isolation via scan** → heuristic, but paired with `server-only` and the env allow-list
  it is sufficient; the vendor-import scan is the stronger structural guarantee CLAUDE.md wants.
- **Eval set needs real keys** → kept out of the unit suite and run on demand; documented.

## Migration Plan

1. Install `ai`, `@ai-sdk/anthropic`, `@ai-sdk/openai`; add `AI_PROVIDER`/`AI_MODEL`/
   `AI_FALLBACK` + `ANTHROPIC_API_KEY`/`OPENAI_API_KEY` to `src/env.ts`.
2. Define `lib/ai/port.ts` (port + domain types + usage).
3. Add a shared adapter helper (telemetry + error mapping), then `adapters/anthropic.ts` and
   `adapters/openai.ts` wrapping the AI SDK with env-built clients.
4. Build `lib/ai/index.ts` (registry + env selection + `llm()` accessor).
5. Add `lib/ai/eval/` prompts + runner.
6. Tests: fake provider + registry selection/fallback/unknown; vendor-import scan;
   key-isolation scan. Run `tsc`, the suite, and `next build`.
- **Rollback:** remove `lib/ai` and the AI env vars; the SDK and ping capability are untouched.

## Open Questions

- Whether to enable Anthropic adaptive thinking by default in the adapter (via the AI SDK's
  provider options) — deferred; the minimal port doesn't expose thinking, and the eval set
  will inform whether to turn it on for the assistant change.
