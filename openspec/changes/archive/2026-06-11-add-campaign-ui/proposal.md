## Why

LoreKeeper has a typed, owner-scoped tRPC API and an accessible design system, but no
screens: there is nowhere to actually view or manage campaigns. This change builds the
campaign management UI — server-first, on the design system and tRPC layer — so users can
create and manage their campaigns and all child entities. It also completes the API
surface (full CRUD for every child entity) that the UI requires.

## What Changes

- Add the campaign management UI (App Router, Server Components by default):
  - A **campaigns list** showing only the current user's campaigns.
  - A **campaign detail** page listing its sessions, NPCs, locations, items, and
    characters.
  - **Create/edit forms** for campaigns and every child entity.
- **Server-first data flow**: Server Components fetch by calling tRPC procedures directly
  via the server caller (`~/trpc/server`); Client Components that need optimistic UI or
  refetching use the tRPC React Query hooks (`~/trpc/react`).
- **Mutations** go through tRPC `protectedProcedure`s (already owner-scoped); after a
  mutation, invalidate the relevant query and/or revalidate the affected path.
- **Forms** use `react-hook-form` + `zodResolver`, reusing the SAME Zod schemas from
  `lib/validation` that the procedures use as inputs — one source of truth, re-validated
  server-side regardless of the client.
- **Safety**: all user-entered content renders as plain text; never
  `dangerouslySetInnerHTML`.
- **UX**: loading skeletons, empty states, inline field errors, success/error toasts, and
  optimistic UI for create/delete where safe; fully keyboard/screen-reader accessible and
  responsive.
- **Complete the CRUD API** the UI needs: add full CRUD tRPC procedures (and shared Zod
  schemas + owner-scoped data access) for **Session, Location, Item, Character**, and add
  **update/delete** for **NPC** (which previously had only list/create).
- **Auth-gating**: these pages are unreachable by anonymous users (redirect to login).

## Capabilities

### New Capabilities
- `campaign-ui`: The server-first campaign management screens — list, detail, and
  create/edit forms — including the data-fetching pattern (server caller vs. React Query
  hooks), mutation→invalidate/revalidate flow, react-hook-form + shared-Zod validation,
  plain-text rendering, the UX states (skeleton/empty/error/toast/optimistic), accessibility,
  and auth-gating.

### Modified Capabilities
- `campaign-crud-api`: Add full CRUD procedures for Session, Location, Item, and Character
  (owner-scoped via their parent campaign, validated with shared Zod schemas), and add
  `update`/`delete` procedures for NPC to complete its CRUD.

## Impact

- **Dependencies**: add `react-hook-form` and `@hookform/resolvers`.
- **New validation**: `lib/validation/{session,location,item,character}.ts` (create+update
  schemas); confirm campaign/npc schemas are reused unchanged.
- **Data layer**: extend `lib/data/` with owner-scoped CRUD for the four child entities and
  NPC update/delete.
- **API**: new `src/server/api/routers/{session,location,item,character}.ts`; extend
  `npcRouter`; merge into `appRouter`.
- **UI**: `app/(app)/campaigns/**` route group (list, `[campaignId]` detail, new/edit),
  client form components, list/detail server components, and shared form/field components
  using the design system.
- **Auth**: pages rely on the existing proxy + `getCurrentUser`/`protectedProcedure`;
  anonymous users are redirected to login.
- **Tests**: forms reject invalid input; procedures/server flows enforce ownership
  (cross-user → not found); anonymous users cannot reach these pages.
- No data-model/schema (Prisma) changes; no AI features.
