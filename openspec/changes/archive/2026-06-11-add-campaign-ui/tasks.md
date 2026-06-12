## 1. Dependencies & shared Zod schemas

- [x] 1.1 Install `react-hook-form` and `@hookform/resolvers`
- [x] 1.2 Add `updateNpcSchema` to `lib/validation/npc.ts` (partial, ≥1 field)
- [x] 1.3 Add `lib/validation/session.ts` (`createSessionSchema`/`updateSessionSchema`: title required, `date` coercible to Date, optional summary/notes)
- [x] 1.4 Add `lib/validation/location.ts` (`createLocationSchema`/`updateLocationSchema`: name required, optional description)
- [x] 1.5 Add `lib/validation/item.ts` (`createItemSchema`/`updateItemSchema`: name required, optional description, optional `ownerNpcId`)
- [x] 1.6 Add `lib/validation/character.ts` (`createCharacterSchema`/`updateCharacterSchema`: name, playerName, class required; `level` int ≥ 1; optional notes)

## 2. Owner-scoped data layer

- [x] 2.1 Add a `requireOwnedCampaign(ownerId, campaignId)` helper that resolves an owned campaign or returns not-found
- [x] 2.2 Add NPC `update`/`delete` data functions (owner-scoped via parent campaign)
- [x] 2.3 Add `lib/data/sessions.ts`: list/create/update/delete owner-scoped via parent campaign
- [x] 2.4 Add `lib/data/locations.ts`: list/create/update/delete owner-scoped
- [x] 2.5 Add `lib/data/items.ts`: list/create/update/delete owner-scoped; verify `ownerNpcId` (when set) belongs to the same campaign, else reject
- [x] 2.6 Add `lib/data/characters.ts`: list/create/update/delete owner-scoped

## 3. tRPC routers

- [x] 3.1 Extend `npcRouter` with `update` and `delete` (reuse shared schemas; not-found → `NOT_FOUND`)
- [x] 3.2 Add `sessionRouter` (listByCampaign/create/update/delete)
- [x] 3.3 Add `locationRouter` (listByCampaign/create/update/delete)
- [x] 3.4 Add `itemRouter` (listByCampaign/create/update/delete)
- [x] 3.5 Add `characterRouter` (listByCampaign/create/update/delete)
- [x] 3.6 Merge all routers into `appRouter` (`src/server/api/root.ts`)

## 4. App route group, guard & reads

- [x] 4.1 Add `app/(app)/layout.tsx` that calls `getCurrentUser()` and `redirect("/login")` when unauthenticated
- [x] 4.2 Build `app/(app)/campaigns/page.tsx` (Server Component) listing the user's campaigns via `~/trpc/server`, with skeleton + empty state + create action
- [x] 4.3 Build `app/(app)/campaigns/[campaignId]/page.tsx` (Server Component) fetching the campaign + all child lists via `~/trpc/server`; render not-found UI for unowned/missing
- [x] 4.4 Pass server-fetched data as `initialData` into Client Component sections per child entity

## 5. Forms, mutations & UX

- [x] 5.1 Add a shared accessible `FormField` wrapper (label + control + inline error wired via `aria-describedby`/`aria-invalid`) and a form dialog pattern
- [x] 5.2 Campaign create/edit (pages): react-hook-form + `zodResolver(createCampaignSchema/updateCampaignSchema)`; mutate via `~/trpc/react`; on success toast + invalidate + `router.refresh()`
- [x] 5.3 Child-entity sections (NPC, Session, Location, Item, Character): list with empty state, create/edit dialog forms reusing the shared Zod schemas, delete with confirm
- [x] 5.4 Item form: NPC owner select limited to the campaign's NPCs
- [x] 5.5 Optimistic create/delete where safe (update cache immediately, roll back on error); success/error toasts on every mutation
- [x] 5.6 Render all user content as plain text (no `dangerouslySetInnerHTML`); loading skeletons for pending sections

## 6. Tests

- [x] 6.1 Form validation: invalid input is blocked with inline field errors (jsdom) for a representative form (e.g. campaign + character)
- [x] 6.2 Ownership enforced: cross-user `list`/`update`/`delete` on each new router yields `NOT_FOUND`; anonymous → `UNAUTHORIZED` (mocked data layer, `createCaller`)
- [x] 6.3 Item `ownerNpcId` outside the campaign is rejected (data layer / router)
- [x] 6.4 Anonymous users cannot reach campaign pages: the `(app)` layout redirects to `/login` when `getCurrentUser()` is null (mocked)
- [x] 6.5 User content renders as literal text (script-like string is not interpreted)

## 7. Verification

- [x] 7.1 Run `npx tsc --noEmit` and fix any type errors (no `any`)
- [x] 7.2 Run the Vitest suite (node + jsdom) and confirm all tests pass
- [x] 7.3 Confirm `next build` succeeds; campaign routes are registered and gated
