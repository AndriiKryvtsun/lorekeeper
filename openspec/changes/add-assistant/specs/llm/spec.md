## MODIFIED Requirements

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

## ADDED Requirements

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
