-- Entity enrichment provenance: record where an NPC/Character came from and, for SRD-sourced
-- entities, the OGL/CC attribution. Both columns are nullable so existing rows (manual entry)
-- backfill to NULL with no data migration. RLS is unchanged — child policies key on the
-- parent campaign's owner.
ALTER TABLE "NPC" ADD COLUMN "source" TEXT;
ALTER TABLE "NPC" ADD COLUMN "attribution" TEXT;

ALTER TABLE "Character" ADD COLUMN "source" TEXT;
ALTER TABLE "Character" ADD COLUMN "attribution" TEXT;
