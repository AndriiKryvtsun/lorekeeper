# llm Specification

## Purpose

Provide a vendor-neutral LLM capability for the application. All access to large
language models goes through a single `LlmProvider` port defined under `lib/ai/`,
keeping vendor and AI-SDK details confined to adapter files. Provider and model
selection is env-driven via a registry with ordered fallback, calls emit redacted
telemetry and typed errors, and all provider keys remain server-only.

## Requirements

### Requirement: Vendor-neutral LlmProvider port
The system SHALL define a single `LlmProvider` port (interface) under `lib/ai/` using only
vendor-neutral domain types — a list of messages, an optional system prompt, an optional
`maxOutputTokens`, an optional `temperature`, and an optional `AbortSignal`. The port SHALL
expose `generate()`, `stream()`, and `generateObject<T>(schema)`, and every result SHALL
include the produced text/object plus token usage. No vendor- or SDK-specific type SHALL
appear in the port's signatures.

#### Scenario: Callers depend only on the port
- **WHEN** application code uses the LLM capability
- **THEN** it programs against the `LlmProvider` port and vendor-neutral types, never a vendor SDK type

#### Scenario: Results carry text/object and token usage
- **WHEN** `generate`, `stream`, or `generateObject` completes
- **THEN** the result includes the output (text or typed object) and the call's token usage

### Requirement: generateObject validates against a schema
`generateObject<T>(schema)` SHALL return an object validated against the supplied schema; a
result that does not conform to the schema SHALL be rejected rather than returned.

#### Scenario: Conforming object is returned
- **WHEN** the model returns output matching the schema
- **THEN** the validated, typed object is returned

#### Scenario: Non-conforming output is rejected
- **WHEN** the model output does not match the schema
- **THEN** the call fails rather than returning an invalid object

### Requirement: Anthropic and OpenAI adapters behind the port
The system SHALL implement Anthropic and OpenAI adapters that implement `LlmProvider`. Each
adapter SHALL wrap the Vercel AI SDK as its transport; the shared REST transport from the
SDK is intentionally NOT used for LLM calls. Adapters SHALL translate the vendor-neutral
inputs into the AI SDK's calls and map the AI SDK's text + usage back into the port's
results.

#### Scenario: Adapter implements the port via the AI SDK
- **WHEN** an adapter handles a `generate`/`stream`/`generateObject` call
- **THEN** it fulfills the port using the Vercel AI SDK and returns vendor-neutral results

#### Scenario: AbortSignal cancels a call
- **WHEN** a caller passes an `AbortSignal` and aborts it
- **THEN** the in-flight provider call is cancelled

### Requirement: Vendor SDK imports confined to adapter files
Only files within `lib/ai/` SHALL import a PROVIDER/model SDK (`ai`, `@ai-sdk/anthropic`,
`@ai-sdk/openai`, or any provider SDK). No file outside `lib/ai/` SHALL import such a package.
The client UI transport hook `@ai-sdk/react` (`useChat`) is EXEMPT from this rule: it talks
to our own route over HTTP, performs no model-provider call, and MAY be imported in Client
Components for the chat UI.

#### Scenario: No provider SDK import escapes lib/ai
- **WHEN** the codebase is scanned for provider/model SDK imports (`ai`, `@ai-sdk/anthropic`, `@ai-sdk/openai`)
- **THEN** every such import is inside `lib/ai/`, and nowhere else

#### Scenario: The UI transport hook is permitted in the client
- **WHEN** a Client Component imports `@ai-sdk/react` (`useChat`)
- **THEN** that is allowed, because it is a UI transport hook that calls our own route, not a model provider

### Requirement: Registry-based, env-driven provider selection and fallback
The adapters SHALL be registered through the core SDK `Registry`, and the active provider
and model SHALL be selected from `~/env` (`AI_PROVIDER`, `AI_MODEL`, optional fallback), not
from caller code. An ordered fallback SHALL be supported. Switching the active provider
SHALL be a change to `~/env` only.

#### Scenario: Active provider comes from env
- **WHEN** `AI_PROVIDER`/`AI_MODEL` name a registered adapter
- **THEN** the registry resolves to that adapter/model

#### Scenario: Switching provider is an env change
- **WHEN** `AI_PROVIDER` is changed to another registered provider
- **THEN** callers receive the new provider with no change to caller code

#### Scenario: Fallback to the next provider
- **WHEN** the primary LLM provider is unavailable and a fallback is configured
- **THEN** the capability resolves to the next provider in order

### Requirement: Reused telemetry and typed errors
LLM calls SHALL emit the SDK's redacted per-call telemetry tagged by capability (`llm`) and
provider id, and SHALL surface failures as the SDK's typed errors. Prompts, completions,
secrets, and PII SHALL NOT be logged.

#### Scenario: Each LLM call emits a tagged metric
- **WHEN** an LLM call completes (success or failure)
- **THEN** a latency/outcome metric tagged with capability `llm` and the provider id is recorded, with no prompt/secret content

### Requirement: Server-only with isolated provider keys
All of `lib/ai/` SHALL be server-only, and provider API keys (`ANTHROPIC_API_KEY`,
`OPENAI_API_KEY`) SHALL be injected from `~/env` ONLY and read only inside `lib/ai/` (passed
to the AI SDK's client factories, not read from `process.env` directly elsewhere).

#### Scenario: lib/ai is server-only
- **WHEN** a client bundle is built
- **THEN** `lib/ai` modules and provider keys do not appear in it

#### Scenario: Provider keys read only inside lib/ai
- **WHEN** the codebase is scanned for provider-key access
- **THEN** such access occurs only within `lib/ai` (via `~/env`)

### Requirement: Provider-switch eval set
The system SHALL maintain a small eval set of representative prompts that can be run to
re-check behavior when switching providers/models. The eval set SHALL run against the active
provider via the port (no vendor specifics).

#### Scenario: Eval set runs through the port
- **WHEN** the eval set is executed
- **THEN** each representative prompt runs against the active provider through the `LlmProvider` port and its output can be reviewed

### Requirement: Env-configurable model tiers
The LLM capability SHALL expose a tiered accessor `getProvider(tier)` for the tiers
`classify`, `answer`, and `reasoning`, each resolving to a provider bound to a model read
from `~/env` (`AI_MODEL_CLASSIFY`, `AI_MODEL_ANSWER`, `AI_MODEL_REASONING`; defaults
`claude-haiku-4-5`, `claude-sonnet-4-6`, `claude-opus-4-8`). Tier resolution SHALL reuse the
registry and ordered fallback, and selecting a tier's model SHALL be an `~/env` change, not
caller code.

#### Scenario: Each tier resolves to its configured model
- **WHEN** `getProvider("classify" | "answer" | "reasoning")` is called
- **THEN** it returns a provider bound to that tier's model from `~/env` (Claude defaults), via the registry

#### Scenario: Switching a tier's model is an env change
- **WHEN** a tier's env model is changed to another supported model
- **THEN** callers of that tier receive the new model with no change to caller code
