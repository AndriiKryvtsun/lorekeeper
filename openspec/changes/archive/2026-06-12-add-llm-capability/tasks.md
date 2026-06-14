## 1. Dependencies & env

- [x] 1.1 Install `ai`, `@ai-sdk/anthropic`, `@ai-sdk/openai`
- [x] 1.2 Add to `src/env.ts` (server): `AI_PROVIDER` (default `anthropic`), `AI_MODEL` (default `claude-opus-4-8`), optional `AI_FALLBACK`, and optional `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` (server-only secrets)

## 2. Port & domain types

- [x] 2.1 Add `lib/ai/port.ts`: vendor-neutral `LlmMessage`, `LlmCallOptions` (messages, system?, maxOutputTokens?, temperature?, signal?), `LlmUsage`, and the `LlmProvider` interface with `generate`, `stream`, `generateObject<T>(schema)`; `import "server-only"`

## 3. Adapters (only files importing a vendor SDK)

- [x] 3.1 Add `lib/ai/adapters/shared.ts`: a wrapper that records SDK telemetry (`capability: "llm"`, providerId, latency, outcome — no prompt/PII) and maps AI SDK errors to typed SDK errors (`RateLimitError`/`TimeoutError`/`UpstreamError`)
- [x] 3.2 Add `lib/ai/adapters/anthropic.ts`: build the client with `createAnthropic({ apiKey: env.ANTHROPIC_API_KEY })`; implement the port via `generateText`/`streamText`/`generateObject`; omit `temperature` for models that reject it (Opus 4.7/4.8/Fable); `import "server-only"`
- [x] 3.3 Add `lib/ai/adapters/openai.ts`: build the client with `createOpenAI({ apiKey: env.OPENAI_API_KEY })`; implement the port via the AI SDK; forward `temperature`; `import "server-only"`

## 4. Registry wiring

- [x] 4.1 Add `lib/ai/index.ts`: build `Registry<LlmProvider>("llm")`, register `anthropic` + `openai` adapters (each bound to `AI_MODEL`), derive the `SelectionConfig` from `AI_PROVIDER`/`AI_FALLBACK`, expose a typed `llm()` accessor (with fallback); `import "server-only"`

## 5. Eval set

- [x] 5.1 Add `lib/ai/eval/prompts.ts`: a few representative prompts (factual Q, format-following, structured-output) defined in vendor-neutral terms
- [x] 5.2 Add `lib/ai/eval/run.ts`: a runner that executes the prompts through the active provider via the port (manual use when switching providers; not in the unit suite)

## 6. Tests

- [x] 6.1 Add a `FakeLlmProvider` implementing the port (canned text/usage, no network)
- [x] 6.2 Registry/selection: env-driven active provider resolves; ordered fallback; unknown provider → clear error (using the fake)
- [x] 6.3 `generateObject` contract: conforming object returned; non-conforming output rejected (fake/seam)
- [x] 6.4 Vendor-import isolation: a repo scan asserts `ai` / `@ai-sdk/*` / provider SDK imports appear ONLY under `lib/ai/`
- [x] 6.5 Key isolation: a repo scan asserts `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` are referenced only under `lib/ai/` (and `src/env.ts`)

## 7. Verification

- [x] 7.1 Run `npx tsc --noEmit` and fix any type errors (no `any`)
- [x] 7.2 Run the Vitest suite and confirm all tests pass
- [x] 7.3 Confirm `next build` succeeds (lib/ai is server-only; no vendor SDK leaks to the client)
