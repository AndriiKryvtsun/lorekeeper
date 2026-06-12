# campaign-ui

## Purpose

Defines the campaign user interface: the campaigns list and detail pages and the
forms that drive them. Pages render server-first via the `~/trpc/server` caller,
fall back to `~/trpc/react` hooks for interactivity, validate input with the
shared `lib/validation` Zod schemas, and present accessible, responsive screens
with proper loading/empty/error states. All pages require authentication and
render user content as plain text.

## Requirements

### Requirement: Campaigns list page
The system SHALL provide a campaigns list page that shows only the current user's
campaigns, rendered server-first (a Server Component fetching via the `~/trpc/server`
caller). It SHALL show a loading skeleton while pending and an empty state (with a create
action) when the user has no campaigns.

#### Scenario: Only the user's campaigns are listed
- **WHEN** an authenticated user opens the campaigns list
- **THEN** only campaigns owned by that user are shown

#### Scenario: Empty state when there are no campaigns
- **WHEN** an authenticated user with no campaigns opens the list
- **THEN** an empty state with a "create campaign" action is shown

### Requirement: Campaign detail page
The system SHALL provide a campaign detail page that shows the campaign and lists its
sessions, NPCs, locations, items, and characters, rendered server-first. Each child
section SHALL show an empty state when it has no rows. Requesting a campaign the user does
not own SHALL render the not-found UI.

#### Scenario: Detail lists all child entities
- **WHEN** an authenticated user opens a campaign they own
- **THEN** the page shows the campaign and its sessions, NPCs, locations, items, and characters

#### Scenario: Another user's campaign is not found
- **WHEN** an authenticated user opens a campaign owned by a different user
- **THEN** the not-found UI is shown and no data is revealed

### Requirement: Server-first data fetching with client hooks where needed
Server Components SHALL fetch data by calling tRPC procedures directly through the
`~/trpc/server` caller (no client round trip). Client Components that need optimistic
updates or refetching SHALL use the `~/trpc/react` React Query hooks.

#### Scenario: Server Component reads via the server caller
- **WHEN** a page renders on the server
- **THEN** it obtains data through the `~/trpc/server` caller rather than a client fetch

#### Scenario: Client Component uses hooks for interactivity
- **WHEN** a component needs optimistic UI or to refetch after a change
- **THEN** it uses the `~/trpc/react` hooks within the provider

### Requirement: Forms validate with the shared Zod schemas
Create and edit forms SHALL use `react-hook-form` with `zodResolver` and the SAME Zod
schemas from `lib/validation` that the tRPC procedures use as inputs. Invalid input SHALL
be blocked client-side with inline field errors, and the same schema re-validates
server-side in the procedure regardless of the client.

#### Scenario: Invalid input is rejected with inline errors
- **WHEN** a user submits a form with invalid input
- **THEN** submission is blocked and inline field errors are shown next to the offending fields

#### Scenario: Server re-validates with the same schema
- **WHEN** a request reaches the procedure (even if client validation were bypassed)
- **THEN** the procedure validates with the same schema and rejects invalid input

### Requirement: Mutations invalidate or revalidate after success
After a successful mutation, the UI SHALL invalidate the relevant React Query query and/or
revalidate the affected App Router path so the list/detail reflects the change.

#### Scenario: List refreshes after a mutation
- **WHEN** a create, update, or delete succeeds
- **THEN** the affected query is invalidated and/or the path revalidated so the view updates

### Requirement: User content rendered as plain text
The system SHALL render all user-entered content as plain text and MUST NOT use
`dangerouslySetInnerHTML` for any user-provided value.

#### Scenario: Markup in user content is not executed
- **WHEN** user-entered content contains HTML/script-like text
- **THEN** it is displayed as literal text and not rendered as markup

### Requirement: UX states and optimistic updates
The UI SHALL provide loading skeletons, empty states, inline field errors, and
success/error toasts, and SHALL apply optimistic UI for create/delete where safe
(reconciling on success and rolling back on error).

#### Scenario: Success and error are signalled by toasts
- **WHEN** a mutation succeeds or fails
- **THEN** a success or error toast is shown (announced via the aria-live region)

#### Scenario: Optimistic delete rolls back on error
- **WHEN** an optimistic delete fails on the server
- **THEN** the removed item is restored and an error toast is shown

### Requirement: Accessible, responsive screens
The campaign screens SHALL be fully keyboard- and screen-reader-accessible (labelled
controls, inline errors linked to inputs, focus management) and responsive across small
and large viewports, building on the design-system primitives.

#### Scenario: Forms are operable by keyboard with linked errors
- **WHEN** a keyboard user fills and submits a form
- **THEN** all controls are reachable/operable and any errors are associated with their inputs

### Requirement: Campaign pages require authentication
The campaign pages SHALL be unreachable by anonymous users; an unauthenticated request to
any campaign page SHALL be redirected to login.

#### Scenario: Anonymous user is redirected
- **WHEN** an unauthenticated user navigates to a campaign list or detail page
- **THEN** they are redirected to the login route and see no campaign data
