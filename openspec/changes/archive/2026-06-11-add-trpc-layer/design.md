## Context

LoreKeeper has Prisma data access (`lib/prisma.ts`), an owner-scoped data layer
(`lib/data/campaigns.ts`), Zod schemas (`lib/validation/*`), Supabase auth with a
server-only `getCurrentUser()` and a Next.js 16 Proxy (`proxy.ts`), and REST CRUD route
handlers under `app/api/campaigns/**`. The project uses the `@/* → ./*` path alias; `app/`
and `lib/` live at the repo root (no `src/`). CLAUDE.md mandates strict TypeScript (no
`any`), Prisma-only data access, Zod at boundaries, server-only secrets, and tests with
every change. This change adds a tRPC v11 typed API following T3 conventions and migrates
the existing CRUD onto it, reusing the data layer and Zod schemas.

## Goals / Non-Goals

**Goals:**
- tRPC v11 root, context (loads Supabase user), `publicProcedure`, `protectedProcedure`.
- Typed `~/env` module (the single env access point), failing fast on bad config.
- Domain routers (`campaignRouter`, `npcRouter`) as `protectedProcedure`s scoped to
  `ctx.user.id`, reusing `lib/validation` and `lib/data/campaigns`.
- App Router tRPC handler, RSC server caller, React Query client provider, superjson.
- Remove the redundant `app/api/campaigns/**` route handlers.

**Non-Goals:**
- Migrating or building the AI assistant; `app/api/assistant` stays a (future) streaming
  route handler and is out of scope here.
- Moving `app/` or `lib/` into `src/` (only new tRPC/env code lives under `src/`).
- Changing the data model, RLS, or auth flows.
- Building UI beyond the minimal provider wiring needed to satisfy the client-caller spec.

## Decisions

- **Dual path alias.** Add `~/* → ./src/*` alongside the existing `@/* → ./*`. New T3-style
  code (`src/env.ts`, `src/server/api/**`, `src/trpc/**`) uses `~/`; existing root code
  (`app/`, `lib/`) keeps `@/`. Routers import the shared schemas via `@/lib/validation` and
  the data layer via `@/lib/data/campaigns`. Alternative: relocate everything under `src/` —
  rejected as needless churn for this change.
- **Typed env with `@t3-oss/env-nextjs`.** `src/env.ts` declares `server` vars
  (`DATABASE_URL`, `DIRECT_URL`, `SUPABASE_SERVICE_ROLE_KEY`) and `client` vars
  (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`), with `runtimeEnv` mapping
  and `emptyStringAsUndefined`. Runtime modules (`lib/supabase/server.ts`,
  `lib/supabase/client.ts`, `lib/prisma.ts`, `proxy.ts`) import from `~/env` instead of
  `process.env`. `prisma.config.ts` is Prisma CLI tooling (runs outside Next, before the
  app boots) and stays on `dotenv`/`process.env` as a documented exception.
- **Context loads the user via the existing helper.** `createTRPCContext` calls the
  Supabase server client's `auth.getUser()` (the same path as `getCurrentUser()`) and puts
  `user` on the context. `protectedProcedure` middleware throws `TRPCError({ code:
  "UNAUTHORIZED" })` when `ctx.user` is null and otherwise narrows `ctx.user` to non-null.
- **Reuse the owner-scoped data layer.** Procedures call `lib/data/campaigns.ts`
  functions with `ctx.user.id`. A `null`/`false` not-found result maps to
  `TRPCError({ code: "NOT_FOUND" })`. This keeps owner scoping in one place and preserves
  the "404 over 403" existence-hiding rule (now `NOT_FOUND`). Zod input validation failures
  surface as tRPC `BAD_REQUEST` automatically.
- **Error-code mapping.** REST statuses become tRPC codes: 401→`UNAUTHORIZED`,
  404→`NOT_FOUND`, 400→`BAD_REQUEST`. The HTTP responder maps these back to status codes on
  the wire; RSC/direct callers receive typed `TRPCError`s.
- **superjson transformer** on both server and clients so `Date` (e.g. `Campaign.createdAt`,
  `Session.date`) round-trips correctly.
- **RSC caller and client provider.** `~/trpc/server.ts` builds a server-side caller using
  `createTRPCContext` for Server Components (no HTTP). `~/trpc/react.tsx` creates the React
  Query + tRPC client (httpBatchLink to `/api/trpc`, superjson) and a provider component
  mounted in the root layout for Client Components.
- **Remove REST handlers and their tests.** Delete `app/api/campaigns/**` and the
  `*.handlers.test.ts` files; replace with router tests. The owner-scoped data-layer tests
  and validation tests remain valid and unchanged.

## Risks / Trade-offs

- **`@t3-oss/env-nextjs` + Next 16 / edge (`proxy.ts`)** → importing the env module in the
  Proxy (edge runtime) must not pull Node-only APIs; mitigate by keeping `src/env.ts`
  isolated to the t3-env + Zod imports, and skipping validation via `SKIP_ENV_VALIDATION`
  where a build step needs it.
- **"Only place process.env is read" vs. tooling** → `prisma.config.ts` legitimately reads
  `process.env`; documented as an exception so the rule stays meaningful for app runtime.
- **Two aliases (`@/`, `~/`)** → potential confusion; mitigate by the clear rule above
  (new src code uses `~/`, existing root code uses `@/`).
- **tRPC v11 + React Query v5 API churn** → pin known-good versions and keep the client
  wiring minimal; the RSC caller avoids most client surface.
- **Testing tRPC** → use `appRouter.createCaller(ctx)` with a fabricated context (user
  present/absent) and a mocked data layer, so router tests need neither HTTP nor a DB.

## Migration Plan

1. Install the six packages; add `~/*` alias to `tsconfig.json`.
2. Create `src/env.ts`; refactor runtime modules to import from `~/env`.
3. Build `src/server/api/trpc.ts` (context, procedures, transformer) and `root.ts`.
4. Add `routers/campaign.ts` and `routers/npc.ts` reusing `lib/validation` + `lib/data`.
5. Add `app/api/trpc/[trpc]/route.ts`, `~/trpc/server.ts`, `~/trpc/react.tsx`, and mount
   the provider in the root layout.
6. Delete `app/api/campaigns/**` route handlers and their handler tests.
7. Add router/env/caller tests; run `npx tsc --noEmit` and the suite.
- **Rollback:** restore the `app/api/campaigns/**` handlers and remove the tRPC/env
  modules; the data layer and schemas are unchanged, so REST and tRPC are interchangeable
  fronts over the same core.

## Open Questions

- Should the React Query provider use server-side prefetching/hydration now, or is a basic
  client provider enough for this change? Defaulting to a basic provider; hydration can be
  added when UI lands.
