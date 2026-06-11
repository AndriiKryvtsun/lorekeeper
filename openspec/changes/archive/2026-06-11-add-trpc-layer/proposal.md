## Why

The campaign/NPC CRUD is currently a set of hand-written REST route handlers that
duplicate auth + owner-scoping logic and give the client no end-to-end type safety.
Adopting tRPC v11 with T3 conventions gives us a single typed API surface (server →
client) with a typed env module, shared auth/owner context, and far less boilerplate —
the foundation the upcoming AI assistant and UI will build on.

## What Changes

- Add tRPC v11 and React Query: `@trpc/server`, `@trpc/client`, `@trpc/react-query`,
  `@tanstack/react-query`, `superjson`, `@t3-oss/env-nextjs`.
- Adopt T3 conventions:
  - A `~/` import alias (in addition to the existing `@/`).
  - A typed env module `~/env` validating all server and `NEXT_PUBLIC_` variables with
    Zod; it becomes the ONLY place application runtime code reads `process.env`.
  - The tRPC root in `src/server/api/` with a context that loads the current Supabase
    user, a `publicProcedure`, and a `protectedProcedure` whose middleware rejects
    unauthenticated calls.
  - A routers directory split by domain (`campaign`, `npc`).
  - The App Router tRPC handler at `app/api/trpc/[trpc]/route.ts`.
  - An RSC server caller (`~/trpc/server`) for Server Components and a React Query client
    provider (`~/trpc/react`) for Client Components.
  - `superjson` as the transformer.
- **BREAKING** Migrate Campaign + NPC CRUD from REST route handlers to a `campaignRouter`
  and `npcRouter` as `protectedProcedure`s that scope every query/mutation to
  `ctx.user.id` (ownerId from context, never from input) and reuse the shared Zod schemas
  from `lib/validation` as procedure inputs.
- **BREAKING** Remove the now-redundant `app/api/campaigns/**` CRUD route handlers.
  `app/api/assistant` is intentionally left for later and MUST remain a streaming route
  handler (not migrated to tRPC).

## Capabilities

### New Capabilities
- `trpc-api`: The tRPC v11 layer — root/context/procedures, the `protectedProcedure`
  auth middleware, the App Router handler, the RSC server caller, the React Query client
  provider, and superjson transformer.
- `typed-env`: The `~/env` module that validates server and `NEXT_PUBLIC_` variables with
  Zod, fails fast on a missing/invalid variable, and is the single source of env access.

### Modified Capabilities
- `campaign-crud-api`: The Campaign and NPC CRUD is re-exposed as tRPC procedures
  (`campaignRouter`, `npcRouter`) instead of REST route handlers; the route handlers are
  removed. Auth and owner-scoping are preserved but enforced by `protectedProcedure` and
  `ctx.user.id`, and errors are expressed as tRPC error codes rather than HTTP statuses.

## Impact

- **Dependencies**: add the six packages above.
- **Config**: add `~/*` → `./src/*` to `tsconfig.json`; add `superjson` transformer.
- **New code**: `src/env.ts`; `src/server/api/` (`trpc.ts`, `root.ts`, `routers/campaign.ts`,
  `routers/npc.ts`); `app/api/trpc/[trpc]/route.ts`; `src/trpc/server.ts`,
  `src/trpc/react.ts`, and a React Query provider wired into the root layout.
- **Refactor**: application runtime modules that read `process.env`
  (`lib/supabase/server.ts`, `lib/supabase/client.ts`, `lib/prisma.ts`, `proxy.ts`) read
  from `~/env` instead. (`prisma.config.ts` is Prisma CLI tooling, not app runtime, and
  remains a documented exception.)
- **Removed**: `app/api/campaigns/route.ts`, `app/api/campaigns/[campaignId]/route.ts`,
  `app/api/campaigns/[campaignId]/npcs/route.ts` and their handler tests.
- **Reused**: `lib/validation` Zod schemas as procedure inputs; `lib/data/campaigns.ts`
  owner-scoped data layer as the procedures' implementation.
- **Tests**: `protectedProcedure` rejects anonymous callers; cross-user access is
  impossible through any procedure; env validation fails fast; a Server Component caller
  and a Client Component hook can both invoke a procedure.
