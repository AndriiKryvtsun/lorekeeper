# assistant Specification

## Purpose

Provide a grounded, injection-resistant campaign assistant: an authenticated,
owner-scoped chat pipeline that answers strictly from a campaign's own data via
the vendor-neutral LLM port, with validated input, scoped retrieval, hardened
tiered generation, a sanitized chat UI, rate limits and token budgets, and
redacted logging with per-call audit.

## Requirements

### Requirement: Node route handler for the assistant
The assistant SHALL be served by a route handler at `app/api/assistant` declaring
`export const runtime = "nodejs"` (the Prisma pg adapter is not Edge-safe) and a
`maxDuration` suitable for streaming responses.

#### Scenario: Handler runs on the Node runtime
- **WHEN** the assistant route is built
- **THEN** it declares the Node runtime and a streaming-appropriate max duration

### Requirement: Authenticated, owner-scoped access
The pipeline SHALL authenticate via `getCurrentUser()` and verify the current user owns the
requested `campaignId`. A request from an anonymous user SHALL be rejected; a request for a
campaign the user does not own SHALL return 404 (existence not revealed).

#### Scenario: Anonymous request is rejected
- **WHEN** an unauthenticated request hits the assistant
- **THEN** it is rejected and no data is read or generated

#### Scenario: Cross-user campaign yields 404
- **WHEN** an authenticated user asks about a campaign they do not own
- **THEN** the response is 404 and no campaign data is retrieved or sent to the model

### Requirement: Validated, clamped, bounded input
The pipeline SHALL Zod-validate the request, clamp the question to a maximum length, strip
control characters, and reject oversized request bodies before any model call.

#### Scenario: Oversized body is rejected
- **WHEN** a request body exceeds the configured size limit
- **THEN** it is rejected before retrieval or generation

#### Scenario: Question is clamped and sanitized
- **WHEN** a question exceeds the max length or contains control characters
- **THEN** it is clamped/stripped before being used in the prompt

### Requirement: Scoped retrieval with per-type caps
The pipeline SHALL retrieve ONLY the requested campaign's records, through the user-scoped
data layer, with a per-type row cap so the context cannot be flooded.

#### Scenario: Only the owned campaign's records are retrieved
- **WHEN** the pipeline gathers context
- **THEN** it reads only that campaign's records via the owner-scoped data layer, capped per entity type

### Requirement: Grounded, injection-resistant prompt
The pipeline SHALL build a prompt that wraps the retrieved records as untrusted
`<campaign_data>` and instructs the model to answer ONLY from that data, to say "I don't
know" when the answer is not present, and to IGNORE any instructions found inside the data.

#### Scenario: Model answers only from campaign data
- **WHEN** a question's answer is not present in the campaign data
- **THEN** the assistant responds that it does not know rather than inventing an answer

#### Scenario: Injected instructions in data are ignored
- **WHEN** a campaign record contains text resembling an instruction (e.g. "ignore previous instructions")
- **THEN** the assistant treats it as data and does not act on it

### Requirement: Hardened, tiered generation
The pipeline SHALL call the LLM provider with low temperature, a hard `maxOutputTokens` cap,
an `AbortSignal` timeout, retry-with-backoff, and provider fallback, and SHALL cache the
static system prompt. It SHALL classify intent first with a cheap model, answer with a
mid-tier model, and escalate to the high-tier model only when the classifier flags the
question as hard. The answer SHALL be streamed.

#### Scenario: Cheap classify, then tiered answer
- **WHEN** a question is received
- **THEN** a cheap model classifies it, and the answer is produced by the mid-tier model unless the classifier flags it hard, in which case the high-tier model is used

#### Scenario: Generation is bounded and streamed
- **WHEN** the answer is generated
- **THEN** it respects the max-output cap and timeout, retries/falls back on failure, and is streamed to the client

### Requirement: Accessible chat UI with sanitized rendering
The assistant SHALL provide a client chat UI (using the AI SDK's `useChat`) presented as a
docked, floating widget — an always-present launcher button anchored bottom-right that expands a
chat panel — rather than an inline page panel. The panel SHALL render responses through a
sanitizing markdown renderer and NEVER render raw HTML, and SHALL show streaming indicators,
error and empty states, and accessible markup. The widget SHALL reuse the existing `useChat`
client and the `/api/assistant` streaming endpoint unchanged; it MUST NOT bypass the grounding,
server-side ownership check, rate limits, token budget, or sanitized rendering.

#### Scenario: Responses render as sanitized markdown
- **WHEN** the assistant streams a response containing markdown or HTML-like text
- **THEN** it renders through the sanitizing renderer with raw HTML stripped/escaped

#### Scenario: UX states are present and accessible
- **WHEN** the chat is pending, errored, or empty
- **THEN** a streaming indicator, error state, or empty state is shown with accessible markup

#### Scenario: Presented as a docked launcher + panel
- **WHEN** a campaign screen is shown
- **THEN** the assistant appears as a bottom-right launcher that expands a chat panel, not as an inline section of the page

#### Scenario: Server pipeline is unchanged
- **WHEN** a message is sent from the widget
- **THEN** it posts to the same `/api/assistant` endpoint and is subject to the unchanged ownership check, rate limits, token budget, and sanitized rendering

### Requirement: Rate limits and daily token budget
The assistant SHALL enforce per-user AND per-IP rate limits via the external store, and a
per-user daily token budget. Exceeding any limit SHALL block the request before generation.

#### Scenario: Per-user rate limit blocks excess requests
- **WHEN** a user exceeds their request rate limit
- **THEN** further requests are rejected until the window resets, with no model call

#### Scenario: Per-IP rate limit blocks excess requests
- **WHEN** requests from one IP exceed the per-IP limit
- **THEN** further requests from that IP are rejected

#### Scenario: Daily token budget caps usage
- **WHEN** a user's consumed tokens for the day reach the budget
- **THEN** further assistant requests are blocked until the budget resets

### Requirement: Redacted logging and per-call audit
The assistant SHALL emit structured logs with prompts, PII, and secrets REDACTED, and SHALL
write an audit record for each assistant call (who, which campaign, when, outcome, token
usage) without storing the prompt or answer text verbatim.

#### Scenario: Logs never contain prompt/PII/secrets
- **WHEN** the assistant logs a call
- **THEN** the log contains no prompt text, PII, or secrets

#### Scenario: Each call writes an audit record
- **WHEN** an assistant call completes (success or failure)
- **THEN** an audit record is written capturing the user, campaign, timestamp, outcome, and token usage

### Requirement: Non-modal disclosure accessibility for the assistant widget
The widget SHALL be a non-modal disclosure that leaves the page usable while open (no focus
trap, no `aria-modal` on desktop). The launcher SHALL be a real `button` with an accessible name
("Open campaign assistant"), `aria-expanded`, and `aria-controls` referencing the panel; the
panel SHALL be a labelled region. On open, focus SHALL move to the message input; `Esc` SHALL
close the panel and return focus to the launcher. Streamed replies SHALL be announced via a
throttled `aria-live="polite"` (`role="log"`) region on completion (not per token). When a reply
arrives while the panel is collapsed, an unread indicator SHALL appear on the launcher and be
reflected in its accessible name. Targets SHALL be at least 44×44px with visible focus and AA
contrast, open/close motion SHALL respect `prefers-reduced-motion`, and the layout SHALL be a
docked capped-height scrollable panel on desktop and a full-screen sheet on mobile (respecting
safe areas) without permanently hiding critical controls.

#### Scenario: Launcher exposes disclosure semantics
- **WHEN** the launcher is rendered
- **THEN** it is a button with the accessible name, `aria-expanded` reflecting state, and `aria-controls` pointing at the panel

#### Scenario: Focus moves in on open and is restored on Esc
- **WHEN** the panel is opened and later closed with `Esc`
- **THEN** focus moves to the message input on open, and returns to the launcher on close, with no keyboard trap

#### Scenario: Replies announced on completion via a live region
- **WHEN** a streamed reply completes while the panel is open
- **THEN** it is announced once via the `aria-live="polite"` `role="log"` region, not per token

#### Scenario: Unread indicator when collapsed
- **WHEN** a reply arrives while the panel is collapsed
- **THEN** the launcher shows an unread indicator reflected in its accessible name

#### Scenario: Responsive presentation
- **WHEN** the panel is open on desktop vs mobile
- **THEN** it is a docked ~380px capped-height scrollable panel on desktop and a full-screen sheet on mobile, honoring `prefers-reduced-motion` for open/close

### Requirement: Campaign-scoped assistant launcher
The launcher SHALL be mounted in the authenticated app shell but enabled ONLY within a campaign
route, deriving `campaignId` from the route/context. Outside a campaign route it SHALL be hidden
or disabled with a hint. The conversation SHALL reset when the active campaign changes.

#### Scenario: Enabled only within a campaign
- **WHEN** the user is on a campaign route versus elsewhere in the app
- **THEN** the launcher is enabled (scoped to that `campaignId`) on a campaign route, and hidden/disabled with a hint otherwise

#### Scenario: Conversation resets on campaign switch
- **WHEN** the active campaign changes
- **THEN** the in-progress conversation is reset so messages are never carried across campaigns

### Requirement: Lazy-loaded panel with preserved in-app state
The launcher SHALL render eagerly while the panel and its `useChat` client SHALL be lazy-loaded
on first open (`next/dynamic`). The open/closed state and the in-progress conversation SHALL
persist across in-app navigation within the same campaign.

#### Scenario: Panel is lazy-loaded on first open
- **WHEN** the page loads and the user has not opened the assistant
- **THEN** the launcher is present but the panel + `useChat` are not loaded until the first open

#### Scenario: State persists across in-app navigation
- **WHEN** the user navigates between screens of the same campaign with the panel open
- **THEN** the open state and the in-progress conversation are preserved
