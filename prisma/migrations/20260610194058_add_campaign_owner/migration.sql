-- Add Campaign.ownerId. Existing rows predate ownership, so add the column nullable,
-- backfill with a constant dev/seed owner id, then enforce NOT NULL and index it.

-- 1. Add the column as nullable.
ALTER TABLE "Campaign" ADD COLUMN "ownerId" TEXT;

-- 2. Backfill pre-existing rows with the constant seed owner id.
UPDATE "Campaign" SET "ownerId" = '00000000-0000-0000-0000-000000000000' WHERE "ownerId" IS NULL;

-- 3. Enforce NOT NULL now that every row has a value.
ALTER TABLE "Campaign" ALTER COLUMN "ownerId" SET NOT NULL;

-- 4. Index ownerId for owner-scoped queries.
CREATE INDEX "Campaign_ownerId_idx" ON "Campaign"("ownerId");
