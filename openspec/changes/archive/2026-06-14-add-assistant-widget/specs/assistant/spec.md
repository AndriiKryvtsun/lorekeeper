## MODIFIED Requirements

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

## ADDED Requirements

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
