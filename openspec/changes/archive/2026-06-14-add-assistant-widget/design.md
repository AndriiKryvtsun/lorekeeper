## Context

The assistant is currently `CampaignChat`, an inline section rendered at the bottom of
`app/(app)/campaigns/[campaignId]/page.tsx`, using `@ai-sdk/react`'s `useChat` against
`/api/assistant` and rendering through `SafeMarkdown`. This change is a presentation refactor
into a docked floating widget. There is no `CampaignContext` today; `campaignId` is available
from the route. The authenticated app shell (`AppShell`, mounted in `app/(app)/layout.tsx`)
persists across in-app navigation within the `(app)` group, making it the right home for a
persistent widget.

## Goals / Non-Goals

**Goals:**
- A bottom-right launcher → expandable chat panel, campaign-scoped, accessible (non-modal),
  responsive, lazy-loaded, with conversation preserved across in-app navigation.
- Zero change to the server pipeline or the grounded/secured behavior.

**Non-Goals:**
- No change to `/api/assistant`, grounding, ownership, rate limits, budget, or sanitization.
- No cross-campaign history; no multi-conversation management.
- No reload-survival requirement (a cookie is optional; not implemented here).

## Decisions

### 1. Client launcher in the app shell; `campaignId` from the route
A client `AssistantWidget` is rendered inside `AppShell` (a server component rendering a client
child is fine). It reads `campaignId` via `useParams()`. On a campaign route the launcher is
enabled and scoped to that id; elsewhere it is hidden/disabled with a hint. Living in the
shell — which does not remount across `(app)` navigation — is what lets open/closed state and
the conversation persist across in-app navigation. Alternative considered: a `CampaignContext`
provider (rejected as unnecessary — the route param is the source of truth and avoids new
plumbing).

### 2. Lazy panel that stays mounted after first open; keyed by `campaignId`
The launcher renders eagerly. The chat panel (which owns `useChat`) is `next/dynamic(() => ...,
{ ssr: false })`, rendered only after the FIRST open (a `hasOpened` flag), then kept mounted and
toggled with visibility (not unmounted) so `useChat` state survives collapse/expand and
navigation. The panel element is `key={campaignId}`, so switching campaigns remounts it — a
clean conversation reset — while same-campaign navigation preserves it. This reconciles
"lazy-load on first open" with "persist the in-progress conversation."

### 3. Non-modal disclosure, not a modal
The launcher is a `<button>` with `aria-expanded`, `aria-controls="assistant-panel"`, and an
accessible name; the panel is a `role="region"` labelled by a heading. No focus trap and no
`aria-modal` — the page stays operable. Focus moves to the message input on open (input `ref` +
effect); a keydown handler on the panel closes on `Esc` and returns focus to the launcher
(`ref`). Rationale: a persistent helper must not hijack the page; WAI-ARIA disclosure is the
correct pattern. Alternative considered: a Radix Dialog (rejected — it traps focus and is modal).

### 4. Announce replies on completion via a polite log region
A visually-hidden `aria-live="polite" role="log"` element receives the latest assistant message
text when `useChat` `status` transitions to settled (reply complete), not on every token —
avoiding a flood of SR chatter. The same completion signal sets an unread flag when the panel is
collapsed.

### 5. Unread indicator reflected in the accessible name
When a reply completes while collapsed, a visual dot appears on the launcher AND its accessible
name becomes e.g. "Open campaign assistant, new reply". Opening clears it. Rationale: SR users
must get the same unread signal sighted users do.

### 6. Responsive presentation + motion
Desktop: `fixed` bottom-right, ~380px wide, capped max-height, internal scroll. Mobile:
full-screen sheet (`inset-0`) honoring safe-area insets via `env(safe-area-inset-*)` padding.
Open/close transition is `motion-safe:` only (the global `prefers-reduced-motion: reduce` rule
already neutralizes it). A bounded `z-index` keeps the collapsed launcher from permanently
covering critical controls.

## Risks / Trade-offs

- **Focus management without a trap can be fiddly** → Keep it minimal: focus the input on open,
  handle `Esc` at the panel root, restore focus to the launcher ref on close; covered by tests.
- **Lazy-load vs. state persistence tension** → Resolved by Decision 2 (mount-after-first-open +
  keep-mounted + key by `campaignId`).
- **Testing `next/dynamic`** → Tests assert the behavior (panel/input absent until first open,
  present after) rather than the dynamic-import mechanism; `useChat`, `useParams`, and the
  dynamic import are mocked so the widget renders synchronously under jsdom.
- **Reload does not restore state** → Accepted (out of scope); a cookie could be added later
  without changing the server.

## Open Questions

- None blocking. A cookie-based reload-survival for open/closed could be a follow-up.
