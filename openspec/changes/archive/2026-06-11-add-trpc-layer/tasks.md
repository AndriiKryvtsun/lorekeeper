## 1. Dependencies & aliases

- [x] 1.1 Install `@trpc/server`, `@trpc/client`, `@trpc/react-query`, `@tanstack/react-query`, `superjson`, `@t3-oss/env-nextjs`
- [x] 1.2 Add `~/*` → `./src/*` to `tsconfig.json` `paths` (keep existing `@/*` → `./*`)

## 2. Typed env

- [x] 2.1 Create `src/env.ts` with `@t3-oss/env-nextjs`: `server` (`DATABASE_URL`, `DIRECT_URL`, `SUPABASE_SERVICE_ROLE_KEY`), `client` (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`), `runtimeEnv` mapping, `emptyStringAsUndefined: true`
- [x] 2.2 Refactor `lib/supabase/server.ts`, `lib/supabase/client.ts`, `lib/prisma.ts`, `proxy.ts` to read config from `~/env` instead of `process.env`
- [x] 2.3 Confirm `prisma.config.ts` remains the only `process.env` reader (documented tooling exception)

## 3. tRPC root, context, procedures

- [x] 3.1 Create `src/server/api/trpc.ts`: `createTRPCContext` loading the Supabase user as `ctx.user`; `initTRPC` with `superjson` transformer and an error formatter
- [x] 3.2 Export `publicProcedure` and `protectedProcedure` (middleware throws `UNAUTHORIZED` when `ctx.user` is null and narrows it to non-null)
- [x] 3.3 Create `src/server/api/root.ts` exporting `appRouter` and the `AppRouter` type

## 4. Domain routers (migrate CRUD)

- [x] 4.1 `src/server/api/routers/campaign.ts`: `list`, `byId`, `create`, `update`, `delete` as `protectedProcedure`s scoped to `ctx.user.id`, reusing `lib/validation` schemas and `lib/data/campaigns`; map not-found → `NOT_FOUND`
- [x] 4.2 `src/server/api/routers/npc.ts`: `listByCampaign`, `create` as `protectedProcedure`s scoped to `ctx.user.id`; parent from input `campaignId`; not-found/unowned → `NOT_FOUND`
- [x] 4.3 Merge both routers into `appRouter`

## 5. Handler, callers, provider

- [x] 5.1 Add `app/api/trpc/[trpc]/route.ts` serving `appRouter` for `GET`/`POST` via the fetch adapter with `createTRPCContext`
- [x] 5.2 Add `src/trpc/server.ts`: RSC server caller (direct, no HTTP) using `createTRPCContext`
- [x] 5.3 Add `src/trpc/react.tsx`: React Query + tRPC client (httpBatchLink to `/api/trpc`, superjson) and a provider component
- [x] 5.4 Mount the provider in `app/layout.tsx`

## 6. Remove redundant REST CRUD

- [x] 6.1 Delete `app/api/campaigns/route.ts`, `app/api/campaigns/[campaignId]/route.ts`, `app/api/campaigns/[campaignId]/npcs/route.ts`
- [x] 6.2 Delete the REST handler tests (`app/api/campaigns/*.handlers.test.ts`); remove now-empty dirs
- [x] 6.3 Confirm `app/api/assistant` is untouched (still reserved as a future streaming route handler)

## 7. Tests

- [x] 7.1 `protectedProcedure` rejects an anonymous caller (`UNAUTHORIZED`) via `appRouter.createCaller` with `user: null`
- [x] 7.2 Cross-user access is impossible: `byId`/`update`/`delete`/`npc.listByCampaign`/`npc.create` yield `NOT_FOUND` for another user's campaign (mocked data layer)
- [x] 7.3 `ownerId` comes from `ctx.user.id`, not input: `create` ignores any `ownerId` in input
- [x] 7.4 Env validation fails fast on a missing/invalid variable (e.g. via `createEnv` with a stubbed `runtimeEnv`)
- [x] 7.5 A Server Component can call a procedure directly (RSC caller) and a Client Component via hooks — verified through the caller/client wiring (typed call returns data with a mocked context/transport)

## 8. Verification

- [x] 8.1 Run `npx tsc --noEmit` and fix any type errors (no `any`)
- [x] 8.2 Run the Vitest suite and confirm all tests pass
- [x] 8.3 Confirm the app boots (`next dev`) and `/api/trpc` responds; `/api/campaigns/*` no longer exists
