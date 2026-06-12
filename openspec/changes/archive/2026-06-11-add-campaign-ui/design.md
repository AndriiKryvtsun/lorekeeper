## Context

The backend exposes a typed, owner-scoped tRPC API (`campaignRouter` full CRUD; `npcRouter`
list/create) reachable via the RSC server caller (`~/trpc/server`) and React Query client
(`~/trpc/react`). The design system provides accessible primitives (Button, Input, Textarea,
Select, Dialog, Card, Toast, Skeleton, EmptyState, ErrorState), an app shell, error
boundary, and not-found page. Auth is enforced by the proxy (redirects unauthenticated
requests) and `protectedProcedure`. Shared Zod schemas live in `lib/validation` (campaign,
npc). There are no screens yet. This change builds the campaign management UI and completes
the CRUD API for the remaining child entities so every section is manageable.

## Goals / Non-Goals

**Goals:**
- Server-first list/detail pages and create/edit forms for campaigns and all child
  entities, on the design system.
- Full CRUD tRPC procedures + shared Zod schemas + owner-scoped data access for Session,
  Location, Item, Character; complete NPC (update/delete).
- Server caller for reads; React Query hooks for optimistic/refetch; mutation → invalidate
  / revalidate.
- react-hook-form + zodResolver reusing the procedure input schemas; server re-validates.
- Plain-text rendering; UX states (skeleton/empty/inline errors/toasts/optimistic);
  accessible + responsive; auth-gated pages.

**Non-Goals:**
- Prisma/data-model changes (entities already exist).
- AI features; search, filtering, pagination, drag-and-drop.
- Real-time/multiplayer; sharing between users.
- A component gallery beyond what these screens need.

## Decisions

- **Route group `app/(app)/campaigns/**`.** `page.tsx` (list), `[campaignId]/page.tsx`
  (detail), and form routes (`new`, `[campaignId]/edit`). An `app/(app)/layout.tsx` calls
  `getCurrentUser()` and `redirect("/login")` when absent — defense-in-depth behind the
  proxy so server-first pages never render for anonymous users.
- **Server-first reads, client sections for interactivity.** Page Server Components fetch
  initial data through the `~/trpc/server` caller and pass it to Client Component sections.
  Those sections use `~/trpc/react` `useQuery({ initialData })` so they hydrate without a
  refetch yet can optimistically mutate and refetch. This satisfies "server-first" while
  enabling optimistic UI where the spec asks for it.
- **Mutations: hook + invalidate + refresh.** Client mutations use the tRPC React Query
  `useMutation`; `onSuccess` invalidates the relevant `utils.<router>.<proc>` query and
  calls `router.refresh()` to revalidate the server-rendered content of the current path.
  Optimistic create/delete update the cached list immediately and roll back `onError`.
- **One Zod source of truth.** Forms import the exact `lib/validation` schemas the
  procedures use (`zodResolver(schema)`). New entities get `create*`/`update*` schemas; an
  `updateNpcSchema` is added to complete NPC. Server-side, the procedure re-validates with
  the same schema, so bypassing the client cannot inject invalid data.
- **Owner-scoping reused, extended generically.** A `requireOwnedCampaign(ownerId,
  campaignId)` data helper resolves an owned campaign or signals not-found; per-entity data
  modules (`lib/data/{sessions,locations,items,characters}.ts`, plus NPC update/delete)
  build on it. Child routers mirror the NPC pattern: `listByCampaign`, `create`, `update`,
  `delete`, all `protectedProcedure`s mapping not-found → `NOT_FOUND`.
- **Item owner-NPC integrity.** `item.create`/`update` accept an optional `ownerNpcId`;
  the data layer verifies that NPC belongs to the same (owned) campaign before linking,
  else rejects — preventing cross-campaign references.
- **Plain text only.** All rendering uses JSX text interpolation (React escapes by
  default); `dangerouslySetInnerHTML` is never used. A test asserts script-like content
  renders literally.
- **UX building blocks.** Skeletons via `Skeleton` (and Suspense/`loading.tsx` where it
  fits), `EmptyState` per empty section, inline errors from react-hook-form linked via
  `aria-describedby`/`aria-invalid`, and `toast()` for success/error (aria-live viewport).
- **Forms in Dialogs.** Create/edit use the `Dialog` primitive (focus-trapped, labelled)
  with a shared `FormField` wrapper for consistent label+error wiring; campaign create/edit
  may also be full pages (`new`, `edit`). Keeps interactions uniform and accessible.
- **Testing.** Form tests render with jsdom + Testing Library and assert invalid input is
  blocked with inline errors. Router tests (node) assert ownership: cross-user mutate/list
  → `NOT_FOUND`, anonymous → `UNAUTHORIZED`, via `createCaller` with a fabricated context
  and a mocked data layer. A page/guard test asserts the `(app)` layout redirects when
  `getCurrentUser()` is null (mocked).

## Risks / Trade-offs

- **Server-rendered lists vs. optimistic client state** → reconciled by seeding client
  sections with `initialData` and using `router.refresh()` after mutations so server and
  client views converge; optimistic updates roll back on error.
- **Scope (6 entities × CRUD + forms)** → mitigate with shared patterns: one
  `requireOwnedCampaign` helper, a generic entity-section + form-dialog shape reused per
  entity, so per-entity code is thin.
- **`router.refresh()` + React Query double sources** → keep each list owned by one query;
  refresh re-runs the server component which re-seeds `initialData`. Avoid duplicating the
  same list in two independently-fetching components.
- **Item→NPC cross-campaign linking** → enforced server-side in the data layer, not just
  the form select, so it holds regardless of client.
- **Auth gating depends on proxy + layout guard** → both are in place; the layout guard
  ensures correctness even if proxy matching changes.

## Migration Plan

1. Add `react-hook-form`, `@hookform/resolvers`; add `update`/create Zod schemas for the
   child entities and `updateNpcSchema`.
2. Add `requireOwnedCampaign` + per-entity owner-scoped data functions and NPC
   update/delete.
3. Add `sessionRouter`/`locationRouter`/`itemRouter`/`characterRouter`, extend `npcRouter`,
   merge into `appRouter`.
4. Build the `(app)` layout guard, campaigns list, detail page, and create/edit forms with
   the design system; wire mutations → invalidate/refresh, toasts, optimistic create/delete.
5. Add tests (forms, ownership, anonymous redirect); run `npx tsc --noEmit`, the suite, and
   `next build`.
- **Rollback:** remove the `(app)/campaigns` routes and the new routers/schemas/data
  modules; the prior API (campaign + npc list/create) and screens-less app remain intact.

## Open Questions

- Edit forms seed from data already fetched by the detail page (no per-row `byId` query) —
  assumed sufficient; add `byId` queries only if deep-linking to an edit form is needed.
- Campaign create/edit as full pages vs. dialogs — defaulting to pages for campaigns and
  dialogs for child entities; can unify later.
