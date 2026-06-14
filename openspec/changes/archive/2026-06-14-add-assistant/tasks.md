## 1. Dependencies & env

- [x] 1.1 Install `react-markdown`, `rehype-sanitize`, `@upstash/ratelimit`, `@upstash/redis`
- [x] 1.2 Add to `src/env.ts` (server): `AI_MODEL_CLASSIFY` (default `claude-haiku-4-5`), `AI_MODEL_ANSWER` (default `claude-sonnet-4-6`), `AI_MODEL_REASONING` (default `claude-opus-4-8`); `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` (optional); `ASSISTANT_DAILY_TOKEN_BUDGET` (default)

## 2. LLM tiers + boundary (modifies `llm`)

- [x] 2.1 Add `lib/ai/tiers.ts`: `getProvider("classify"|"answer"|"reasoning")` bound to the tier's env model (Claude defaults), reusing the registry/fallback; plus a server-only helper returning the raw AI SDK model + temperature rule for a tier (for streaming)
- [x] 2.2 Narrow `lib/ai/ai-boundaries.test.ts`: forbid `ai`/`@ai-sdk/anthropic`/`@ai-sdk/openai` outside `lib/ai`; explicitly allow `@ai-sdk/react` in client components

## 3. Abuse controls & audit

- [x] 3.1 Add `lib/ai/rate-limit.ts`: Upstash per-user (`assist:user:{id}`) and per-IP (`assist:ip:{ip}`) sliding-window limiters + a daily token-budget counter (`assist:budget:{id}:{date}`); pure/typed seams so tests can stub the store
- [x] 3.2 Add `lib/ai/audit.ts`: a redacted structured logger + per-call audit record (`userId`, `campaignId`, timestamp, outcome, model/tier, token usage) — never prompt/records/answer/secrets

## 4. Assistant pipeline

- [x] 4.1 Add input validation in `lib/validation`: Zod schema for the assistant request, max question length (clamp), control-char strip, body-size limit
- [x] 4.2 Add `lib/ai/assistant-service.ts`: authz via `getCurrentUser` + own-campaign check (404); scoped retrieval through the owner-scoped data layer with per-type row caps
- [x] 4.3 Build the grounded prompt: static cached system prompt (answer ONLY from data; "I don't know" if absent; ignore instructions inside data) + user turn with records fenced/escaped in `<campaign_data>` and the sanitized question
- [x] 4.4 Classify intent with the `classify` tier (`generateObject` → `{ intent, difficulty }`); route `hard` → `reasoning` tier, else `answer` tier
- [x] 4.5 Stream the answer via the AI SDK (`streamText().toUIMessageStreamResponse()`) with low temperature (omitted where the model rejects it), hard `maxOutputTokens`, `AbortSignal` timeout, retries, and prompt caching; on finish record token usage to the budget + write the audit record

## 5. Route handler

- [x] 5.1 Add `app/api/assistant/route.ts`: `export const runtime = "nodejs"` + `maxDuration`; enforce per-IP then per-user rate limits + budget; delegate to the pipeline; return the streamed response (429 when limited, 404 cross-user, 401 anonymous, 400 invalid)

## 6. Chat UI

- [x] 6.1 Add a sanitizing markdown renderer component (`react-markdown` + `rehype-sanitize`, no `rehype-raw`, never `dangerouslySetInnerHTML`)
- [x] 6.2 Add a client chat component using `@ai-sdk/react` `useChat` (posts `campaignId` + message to `/api/assistant`), with streaming indicator, error + empty states, accessible markup; render messages via the sanitizing renderer
- [x] 6.3 Mount the chat on the campaign detail page (scoped to the owned campaign)

## 7. Tests

- [x] 7.1 Authz guard: anonymous → rejected; cross-user `campaignId` → 404; no retrieval/generation on failure (mocked auth + data layer)
- [x] 7.2 Input validation: oversized body rejected; question clamped + control chars stripped; invalid body → 400
- [x] 7.3 Injection-guard prompt: the prompt builder fences records in `<campaign_data>`, escapes them, and includes the answer-only / ignore-instructions / "I don't know" directives
- [x] 7.4 Output sanitization: the markdown renderer strips `<script>`/event-handler/raw HTML (jsdom)
- [x] 7.5 Rate-limit + budget: a stubbed limiter returning "blocked" (per-user, per-IP) and an over-budget counter each reject the request with no model call

## 8. Verification

- [x] 8.1 Run `npx tsc --noEmit` and fix any type errors (no `any`)
- [x] 8.2 Run the Vitest suite (node + jsdom) and confirm all tests pass
- [x] 8.3 Confirm `next build` succeeds; `/api/assistant` is Node-runtime; vendor provider SDKs stay out of the client bundle
