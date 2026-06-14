## 1. Mount & campaign scoping

- [x] 1.1 Add a client `AssistantWidget` launcher and mount it in `AppShell` (so it persists across in-app navigation in the `(app)` group); derive `campaignId` via `useParams()`
- [x] 1.2 Enable the launcher only within a campaign route; outside one, hide or disable it with a hint
- [x] 1.3 Remove the inline `CampaignChat` mount from `app/(app)/campaigns/[campaignId]/page.tsx`

## 2. Lazy panel reusing the existing client + endpoint

- [x] 2.1 Refactor the existing chat into an `assistant-panel` client component that REUSES `useChat` and posts to `/api/assistant` with `{ body: { campaignId } }`, rendering via `SafeMarkdown`; keep streaming, error, and empty states (no server/pipeline changes)
- [x] 2.2 Lazy-load the panel via `next/dynamic` (`ssr: false`) on first open; after first open keep it mounted (toggle visibility, do not unmount) so the conversation persists
- [x] 2.3 Key the panel by `campaignId` so switching campaigns resets the conversation while same-campaign navigation preserves it

## 3. Non-modal disclosure accessibility

- [x] 3.1 Launcher is a real `button` with accessible name "Open campaign assistant", `aria-expanded`, and `aria-controls` referencing the panel; ≥44×44px target, visible focus, AA contrast
- [x] 3.2 Panel is a labelled `region`; move focus to the message input on open; `Esc` closes and restores focus to the launcher; no focus trap; no `aria-modal` on desktop (page stays usable)
- [x] 3.3 Add a throttled `aria-live="polite"` `role="log"` region that announces a completed reply once (not per token)
- [x] 3.4 Show an unread indicator on the launcher when a reply arrives while collapsed, reflected in its accessible name; clear it on open

## 4. Responsive & motion

- [x] 4.1 Docked ~380px capped-height scrollable panel on desktop; full-screen sheet on mobile (respect safe-area insets); bounded `z-index` so the collapsed launcher never permanently hides critical controls; open/close motion gated behind `motion-safe`/`prefers-reduced-motion`

## 5. State

- [x] 5.1 Hold open/closed and the in-progress conversation in shell-level client state so they persist across in-app navigation within the same campaign; reset on campaign switch (do not depend on localStorage for SSR correctness)

## 6. Tests

- [x] 6.1 Launcher exposes `aria-expanded`, `aria-controls`, and the accessible name (and the unread variant)
- [x] 6.2 `Esc` closes the panel and restores focus to the launcher; focus moves to the input on open; no focus trap
- [x] 6.3 A completed streamed reply is announced via the `aria-live` `role="log"` region (on completion, not per token)
- [x] 6.4 The widget is hidden/disabled outside a campaign route and resets the conversation on campaign switch
- [x] 6.5 The panel + input are NOT rendered until first open (lazy), then present after open
- [x] 6.6 The server pipeline is exercised unchanged: the widget posts to `/api/assistant` with `campaignId`, and the existing route/ownership/rate-limit/sanitization tests still pass

## 7. Verification

- [x] 7.1 Run `npx tsc --noEmit` and fix any type errors (no `any`)
- [x] 7.2 Run the Vitest suite (node + jsdom) and confirm all tests pass
- [x] 7.3 Confirm `next build` succeeds; verify no vendor SDK escapes `lib/ai` and the server endpoint is unchanged
