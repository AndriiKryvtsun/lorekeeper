-- User profile, 1:1 with the Supabase auth user (PK = auth uid).
CREATE TABLE "Profile" (
  "userId" TEXT NOT NULL,
  "displayName" TEXT,
  "avatarUrl" TEXT,
  "bio" TEXT,
  "locale" TEXT,
  "timezone" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Profile_pkey" PRIMARY KEY ("userId")
);

-- Row-Level Security: a user can read/write only their own profile row.
ALTER TABLE "Profile" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Profile owner access" ON "Profile"
  FOR ALL
  USING ("userId" = auth.uid()::text)
  WITH CHECK ("userId" = auth.uid()::text);
