# Project conventions

## Stack
- TypeScript, strictly typed. No `any`.
- Next.js App Router. Server components by default; client components only when needed.
- Prisma is the ONLY data-access layer. No raw SQL.
- Database: Postgres hosted on Supabase. Provider is `postgresql`.
  Prisma connects via the pooled `DATABASE_URL` at runtime and the direct
  `DIRECT_URL` for migrations.

## Method
- We follow Spec-Driven Development with OpenSpec.
- The change specs under openspec/ are the source of truth.
- Update the spec BEFORE changing code. Never edit code to diverge from the spec.

## AI assistant
- All model/prompt logic lives in lib/ai/ and stays swappable.
- The assistant answers ONLY from the campaign's own data (no invented facts).

## Quality
- Every change includes tests.
- Run `npx tsc --noEmit` and the test suite before considering a task done.