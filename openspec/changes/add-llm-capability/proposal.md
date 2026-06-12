## Why

The internal API SDK (Change 4b) gave us a provider registry, telemetry, typed errors, and
env-driven selection/fallback — but no real consumer. The assistant and other features need
an LLM, and CLAUDE.md mandates that the app depend on our own provider PORT, with vendor
SDKs confined to `lib/ai/`. This change builds the LLM capability as the FIRST real consumer
of the SDK: a vendor-neutral `LlmProvider` port with Anthropic and OpenAI adapters wired
through the SDK's `Registry`, switchable entirely via `~/env`.

## What Changes

- Install the Vercel AI SDK and providers: `ai`, `@ai-sdk/anthropic`, `@ai-sdk/openai`.
- Define an `LlmProvider` PORT (interface) under `lib/ai/` with:
  - `generate()` — single completion → text + token usage.
  - `stream()` — streamed text chunks → text + token usage.
  - `generateObject<T>(schema)` — schema-validated structured output → object + usage.
  - Vendor-neutral domain types only: messages, system prompt, `maxOutputTokens`,
    `temperature`, an `AbortSignal`; returns text plus token usage.
- Implement **Anthropic** and **OpenAI** adapters behind the port, each wrapping the Vercel
  AI SDK as its transport (the AI SDK owns HTTP/streaming, so the shared REST transport is
  intentionally NOT used for LLM — permitted by the `api-sdk` "adapter may bypass the shared
  transport" rule).
- Register both adapters through the core SDK's `Registry`, reusing its telemetry, typed
  errors, and `~/env`-driven config + fallback. The active provider/model is selected by
  `AI_PROVIDER` / `AI_MODEL` (+ optional fallback) in `~/env` — never caller code.
- **The adapter files are the ONLY files allowed to import a vendor/AI-SDK package.** All of
  `lib/ai` is `server-only`; provider API keys come from `~/env` (passed to the AI SDK's
  `createAnthropic`/`createOpenAI` factories), never read from `process.env` directly.
- Keep a small **eval set** of representative prompts to re-check behavior when switching
  providers.

## Capabilities

### New Capabilities
- `llm`: The vendor-neutral LLM capability — the `LlmProvider` port (`generate`, `stream`,
  `generateObject`), the Anthropic and OpenAI adapters wrapping the Vercel AI SDK, their
  registration through the SDK `Registry` with `~/env`-driven selection/fallback, telemetry
  + typed-error reuse, the server-only / vendor-SDK-isolation rules, and the provider-switch
  eval set.

### Modified Capabilities
<!-- None. The `api-sdk` capability already permits adapters that bring their own transport
     (its "Resilient HTTP transport" requirement has an explicit "adapter may bypass the
     shared transport" scenario), so the LLM consumer fulfills that design without changing
     any existing requirement. -->

## Impact

- **Dependencies**: add `ai`, `@ai-sdk/anthropic`, `@ai-sdk/openai`.
- **Config**: `~/env` gains `AI_PROVIDER` (default `anthropic`), `AI_MODEL` (default
  `claude-opus-4-8`), optional `AI_FALLBACK`, and server-only `ANTHROPIC_API_KEY` /
  `OPENAI_API_KEY`.
- **New code (all server-only)**: `lib/ai/port.ts` (`LlmProvider` + domain types),
  `lib/ai/adapters/anthropic.ts`, `lib/ai/adapters/openai.ts` (the only vendor-SDK
  importers), `lib/ai/index.ts` (registry build from `~/env` + typed accessor), and
  `lib/ai/eval/` (representative prompts + a runner).
- **Reused**: `lib/sdk/core` `Registry`, telemetry, and typed errors.
- **Tests**: a fake provider implementing the port (no network); registry selection +
  fallback for the LLM capability; an assertion that NO file outside `lib/ai` imports a
  vendor/AI-SDK package; provider API keys read only inside `lib/ai`.
- No data-model, API-route, or UI changes. The assistant feature that consumes this port is
  a later change.
