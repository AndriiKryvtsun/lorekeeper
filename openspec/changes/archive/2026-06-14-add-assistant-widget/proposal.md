## Why

The campaign assistant is an inline panel pinned to the bottom of the campaign detail page, so
the user must scroll to it and it isn't reachable from the campaign's other screens. A docked,
floating launcher makes the assistant persistently available and out of the content flow,
matching the common chat-widget pattern — without changing any of the grounded, secured server
behavior.

## What Changes

- Replace the inline chat mount with a **docked floating widget** anchored bottom-right: an
  always-present launcher button that expands a chat panel. Remove `CampaignChat` from the
  campaign detail page.
- Mount the launcher in the authenticated app shell, but **enable it only within a campaign
  route**; outside a campaign it is hidden/disabled with a hint. `campaignId` is derived from
  the route. The conversation **resets when the active campaign changes**.
- Make it an accessible **non-modal disclosure** (NOT a focus-trapping modal): the launcher is a
  real button with an accessible name, `aria-expanded`, and `aria-controls`; the panel is a
  labelled region; focus moves to the input on open; `Esc` closes and restores focus to the
  launcher; replies are announced via a throttled `aria-live="polite"` `role="log"` region on
  completion; an unread indicator (reflected in the accessible name) appears when a reply
  arrives while collapsed. 44×44px targets, visible focus, AA contrast, `prefers-reduced-motion`,
  and responsive (docked ~380px capped panel on desktop, full-screen sheet on mobile).
- **Lazy-load** the panel + `useChat` on first open (`next/dynamic`); the launcher renders
  eagerly. Open/closed state and the in-progress conversation **persist across in-app
  navigation** within the same campaign.
- **PRESENTATION ONLY:** reuse the existing `useChat` client and the `/api/assistant` streaming
  endpoint. The grounding, server-side ownership check, rate limits, token budget, and
  sanitized markdown rendering are unchanged and MUST NOT be bypassed.

## Capabilities

### New Capabilities
<!-- None. -->

### Modified Capabilities
- `assistant`: the chat UI requirement changes from an inline page panel to a campaign-scoped,
  docked floating disclosure widget (launcher + lazy-loaded panel) with non-modal accessibility;
  the server pipeline and sanitized rendering are unchanged.

## Impact

- **Code**: remove `CampaignChat` from `app/(app)/campaigns/[campaignId]/page.tsx`; add a
  client launcher mounted in the app shell (`components/app-shell.tsx` / the `(app)` layout)
  that reads the campaign from the route (`useParams`); refactor the existing chat into a
  lazy-loaded panel component reusing `useChat` + `SafeMarkdown`; add the disclosure a11y
  (focus management, live region, unread indicator) and responsive docked/sheet styles.
- **Server**: NONE — `/api/assistant`, ownership, rate limits, budget, and sanitization are
  untouched.
- **State**: shell-level client state for open/closed + conversation across in-app navigation;
  reset on campaign switch.
- **Dependencies**: none new (`next/dynamic`, `useParams`, existing `@ai-sdk/react`).
