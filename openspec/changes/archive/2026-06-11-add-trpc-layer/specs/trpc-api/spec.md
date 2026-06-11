## ADDED Requirements

### Requirement: tRPC root with context loading the current user
The system SHALL define a tRPC v11 root in `src/server/api/` whose request context loads
the current Supabase user (via the auth helper) and exposes it as `ctx.user` (null when
unauthenticated). The root SHALL configure `superjson` as the data transformer.

#### Scenario: Context exposes the authenticated user
- **WHEN** a tRPC call is made with a valid session
- **THEN** the procedure's `ctx.user` is the authenticated user including their id

#### Scenario: Context user is null when unauthenticated
- **WHEN** a tRPC call is made without a session
- **THEN** `ctx.user` is null

### Requirement: publicProcedure and protectedProcedure
The system SHALL provide a `publicProcedure` callable without authentication and a
`protectedProcedure` whose middleware rejects unauthenticated calls with a tRPC
`UNAUTHORIZED` error before the resolver runs. After the middleware passes,
`protectedProcedure` resolvers SHALL receive a non-null `ctx.user`.

#### Scenario: protectedProcedure rejects anonymous callers
- **WHEN** a `protectedProcedure` is invoked without a session
- **THEN** the call fails with a tRPC `UNAUTHORIZED` error and the resolver does not run

#### Scenario: protectedProcedure narrows ctx.user to non-null
- **WHEN** a `protectedProcedure` resolver runs
- **THEN** `ctx.user` is typed and present as a non-null authenticated user

### Requirement: Domain routers under an app router
The system SHALL organize procedures into domain routers (e.g. `campaignRouter`,
`npcRouter`) merged into a single app router exported from `src/server/api/root.ts`, with
its `AppRouter` type exported for client typing.

#### Scenario: Routers are merged and typed
- **WHEN** the app router is assembled
- **THEN** it includes the domain routers and exports an `AppRouter` type used by the clients

### Requirement: App Router tRPC handler
The system SHALL expose the tRPC API through a Next.js App Router handler at
`app/api/trpc/[trpc]/route.ts` that serves the app router for `GET` and `POST`.

#### Scenario: Requests are served by the App Router handler
- **WHEN** a tRPC request is sent to `/api/trpc/*`
- **THEN** it is handled by the `app/api/trpc/[trpc]/route.ts` handler using the app router and superjson

### Requirement: RSC server caller and React Query client provider
The system SHALL provide an RSC server caller at `~/trpc/server` so Server Components can
invoke procedures directly, and a React Query client at `~/trpc/react` (with a provider
wired into the app) so Client Components can invoke procedures via hooks. Both SHALL use
`superjson`.

#### Scenario: A Server Component calls a procedure directly
- **WHEN** a Server Component uses the `~/trpc/server` caller
- **THEN** it invokes the procedure server-side without an HTTP round trip and receives typed data

#### Scenario: A Client Component calls a procedure via hooks
- **WHEN** a Client Component uses the `~/trpc/react` hooks within the provider
- **THEN** it invokes the procedure over HTTP and receives typed data
