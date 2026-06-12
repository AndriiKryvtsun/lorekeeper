## Why

The LLM capability (Change 5) gave us a vendor-neutral provider; the data model, auth, and
owner-scoped data layer give us campaign records. This change ships the actual user-facing
feature: a grounded campaign Q&A assistant that answers ONLY from a campaign's own data,
resists prompt injection, streams to an accessible chat UI, and is hardened with authz, rate
limits, a token budget, redacted logging, and an audit trail.

## What Changes

- Install a sanitizing markdown renderer (`react-markdown` + `rehype-sanitize`) and an
  external rate-limit store (`@upstash/ratelimit` + `@upstash/redis`).
- **Route handler** `app/api/assistant` with `export const runtime = "nodejs"` (the Prisma pg
  adapter is not Edge-safe) and a `maxDuration` suitable for streaming.
- **Server pipeline** `lib/ai/assistant-service.ts`:
  - Authenticate via `getCurrentUser()`; verify the user owns `campaignId`, returning 404 on
    mismatch.
  - Zod-validate + clamp the question, strip control characters, reject oversized bodies.
  - Retrieve ONLY that campaign's records through the user-scoped data layer with per-type
    row caps.
  - Build a prompt that wraps records as untrusted `<campaign_data>` and instructs the model
    to answer ONLY from that data, say "I don't know" when absent, and ignore any
    instructions found inside the data.
  - Call the provider with low temperature, a hard `maxOutputTokens` cap, an `AbortSignal`
    timeout, retry-with-backoff, provider fallback, and prompt caching for the static system
    prompt.
  - **Tiered models**: classify intent first with a cheap model (`claude-haiku-4-5`), answer
    with `claude-sonnet-4-6`, and escalate to `claude-opus-4-8` when the classifier flags a
    question as hard. Stream the answer.
- **Chat UI**: a client component using the AI SDK's `useChat`, mounted on the campaign page,
  rendering responses through the sanitizing markdown renderer (never raw HTML), with
  streaming indicators, error/empty states, and accessible markup.
- **Abuse controls**: per-user AND per-IP rate limits via the external store, plus a per-user
  daily token budget.
- **Observability**: structured logging with prompts/PII/secrets REDACTED, and an audit
  record per assistant call.

## Capabilities

### New Capabilities
- `assistant`: The grounded campaign Q&A assistant — the Node route handler, the server
  pipeline (authz, input validation/clamping, scoped retrieval with caps, the
  injection-resistant grounded prompt, tiered streaming generation), the accessible chat UI
  with sanitized-markdown rendering, the per-user/per-IP rate limits and daily token budget,
  and redacted logging + per-call audit records.

### Modified Capabilities
- `llm`: (1) The "vendor SDK imports confined" rule is narrowed to PROVIDER/model SDKs
  (`ai`, `@ai-sdk/anthropic`, `@ai-sdk/openai`) confined to `lib/ai`, explicitly permitting
  the client UI transport hook `@ai-sdk/react` (`useChat`) in Client Components. (2) Add
  env-configurable model tiers — a `getProvider(tier)` accessor (`classify`/`answer`/
  `reasoning`) reading `AI_MODEL_CLASSIFY`/`AI_MODEL_ANSWER`/`AI_MODEL_REASONING` from `~/env`
  (defaults `claude-haiku-4-5`/`claude-sonnet-4-6`/`claude-opus-4-8`), reusing the registry +
  fallback.

## Impact

- **Dependencies**: `react-markdown`, `rehype-sanitize`, `@upstash/ratelimit`, `@upstash/redis`.
- **Config**: `~/env` gains `AI_MODEL_CLASSIFY`/`AI_MODEL_ANSWER`/`AI_MODEL_REASONING` and the
  Upstash Redis URL/token (server-only); per-user daily token budget + rate-limit knobs.
- **New code**: `lib/ai/assistant-service.ts` (pipeline + grounded prompt), `lib/ai/tiers.ts`
  (`getProvider(tier)`), `lib/ai/rate-limit.ts` (Upstash limiters + token budget),
  `lib/ai/audit.ts` (redacted log + audit record), `app/api/assistant/route.ts`, and a chat
  UI client component + sanitized-markdown renderer mounted on the campaign detail page.
- **Modified**: the `lib/ai` boundary test (scope to provider SDKs; allow `@ai-sdk/react` in
  client); `lib/ai/index.ts`/tiers for tiered access.
- **Tests**: authz guard (cross-user → 404), input validation/clamping + oversized-body
  reject, injection-guard prompt behavior (data instructions ignored; "I don't know" when
  absent), output sanitization (no raw HTML/script), rate-limit enforcement (per-user + per-IP)
  and token-budget cap.
- **Sequencing**: this change modifies the `llm` capability, so `add-llm-capability` should be
  archived (its spec synced) before this change is archived.
- No data-model changes; the model never writes to the database.
