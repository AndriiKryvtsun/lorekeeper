## Why

The campaign assistant is read-only: when a user asks it to "create another NPC" it has no
matching fact and falls through to the grounding fallback ("I don't know based on this
campaign's data."), which reads as broken. Users reasonably expect to act on their campaign
through the chat. Our rules forbid the model from mutating the database directly — but they
explicitly allow it to PROPOSE a change that a human confirms. This closes the gap safely.

## What Changes

- The assistant gains a **write path**: when a user's own message expresses an intent to
  create, update, or delete a campaign entity (NPC, location, item, session, or character),
  the assistant produces a **structured, validated proposal** instead of a free-text answer.
- The proposal is rendered in the chat as a **confirmable card** summarizing exactly what
  will change, with **Confirm** and **Cancel** actions. No database write happens on
  proposal alone.
- On explicit human **Confirm**, the app performs the write through the **existing
  owner-scoped data layer / tRPC mutations**, re-validating ownership of `campaignId` and the
  input with the existing Zod schemas. The model is never in the write path.
- Read-only questions keep the existing grounded Q&A behavior unchanged.
- When the assistant can neither answer a question nor form a valid proposal, it responds
  helpfully about what it can do, instead of the bare "I don't know" fallback.
- Both the proposal and the confirmed commit are recorded in the redacted audit log; the
  commit audit ties to the confirming user.

## Capabilities

### New Capabilities
- `assistant-proposals`: write-intent detection that routes a user's create/update/delete
  request to a model-generated, Zod-validated structured proposal; a human-confirmation step
  in the chat UI; and a server-side commit that performs the actual write only on explicit
  confirmation, through the existing owner-scoped data layer — the model never mutates data.

### Modified Capabilities
<!-- None. The existing grounded Q&A behavior of the assistant is unchanged; the write path
     is purely additive and lives in its own capability. -->

## Impact

- **Code**: extends `lib/ai/assistant-service.ts` (intent routing + proposal generation via
  `generateObject`); new proposal Zod schema in `lib/validation`; new commit endpoint/handler
  (e.g. `app/api/assistant/commit`) that delegates to existing owner-scoped mutations; a new
  proposal-card component in `components/assistant`; audit additions in `lib/ai/audit.ts`.
- **APIs**: the existing `/api/assistant` route may return a proposal payload instead of a
  text stream for write intents; a new confirm/commit action is added.
- **Data**: writes go ONLY through the existing Prisma-backed, owner-scoped data layer /
  tRPC mutations; no new direct DB access and no new tables required.
- **Security**: user message and retrieved campaign data remain UNTRUSTED — a write intent
  must originate from the user's own message, never from text embedded in campaign data;
  model output is Zod-validated before use; the commit re-checks ownership and input.
- **Dependencies**: none new (reuses the AI SDK, Zod, and existing data/tRPC layers).
