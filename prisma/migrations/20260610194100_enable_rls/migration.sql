-- Defense-in-depth: enable Row-Level Security with owner-keyed policies on all tables.
-- The app's primary authorization is the owner-scoped data layer (Prisma connects with a
-- role that bypasses RLS); these policies constrain the authenticated/anon roles (e.g.
-- the Supabase data API) so cross-user rows are never exposed there.

-- Supabase provides auth.uid() in production. Prisma's shadow database does not have the
-- `auth` schema, so create a stub ONLY when it is absent. On the real database both the
-- schema and function already exist, so this block is a no-op and never overwrites
-- Supabase's real auth.uid().
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'auth' AND p.proname = 'uid'
  ) THEN
    CREATE SCHEMA IF NOT EXISTS auth;
    EXECUTE 'CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $func$ SELECT NULL::uuid $func$';
  END IF;
END $$;

-- Campaign: owner is the row's ownerId.
ALTER TABLE "Campaign" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Campaign owner access" ON "Campaign"
  FOR ALL
  USING ("ownerId" = auth.uid()::text)
  WITH CHECK ("ownerId" = auth.uid()::text);

-- Child tables: owner is determined via the parent campaign's ownerId.
ALTER TABLE "Session" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Session owner access" ON "Session"
  FOR ALL
  USING (EXISTS (SELECT 1 FROM "Campaign" c WHERE c.id = "Session"."campaignId" AND c."ownerId" = auth.uid()::text))
  WITH CHECK (EXISTS (SELECT 1 FROM "Campaign" c WHERE c.id = "Session"."campaignId" AND c."ownerId" = auth.uid()::text));

ALTER TABLE "NPC" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "NPC owner access" ON "NPC"
  FOR ALL
  USING (EXISTS (SELECT 1 FROM "Campaign" c WHERE c.id = "NPC"."campaignId" AND c."ownerId" = auth.uid()::text))
  WITH CHECK (EXISTS (SELECT 1 FROM "Campaign" c WHERE c.id = "NPC"."campaignId" AND c."ownerId" = auth.uid()::text));

ALTER TABLE "Location" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Location owner access" ON "Location"
  FOR ALL
  USING (EXISTS (SELECT 1 FROM "Campaign" c WHERE c.id = "Location"."campaignId" AND c."ownerId" = auth.uid()::text))
  WITH CHECK (EXISTS (SELECT 1 FROM "Campaign" c WHERE c.id = "Location"."campaignId" AND c."ownerId" = auth.uid()::text));

ALTER TABLE "Item" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Item owner access" ON "Item"
  FOR ALL
  USING (EXISTS (SELECT 1 FROM "Campaign" c WHERE c.id = "Item"."campaignId" AND c."ownerId" = auth.uid()::text))
  WITH CHECK (EXISTS (SELECT 1 FROM "Campaign" c WHERE c.id = "Item"."campaignId" AND c."ownerId" = auth.uid()::text));

ALTER TABLE "Character" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Character owner access" ON "Character"
  FOR ALL
  USING (EXISTS (SELECT 1 FROM "Campaign" c WHERE c.id = "Character"."campaignId" AND c."ownerId" = auth.uid()::text))
  WITH CHECK (EXISTS (SELECT 1 FROM "Campaign" c WHERE c.id = "Character"."campaignId" AND c."ownerId" = auth.uid()::text));
