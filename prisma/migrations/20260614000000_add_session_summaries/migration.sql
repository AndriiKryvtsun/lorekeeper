-- Session: AI-generated summary fields (distinct from the user-authored `summary`), with
-- audit metadata and a source-content hash for idempotent summarization.
ALTER TABLE "Session"
  ADD COLUMN "aiSummary" TEXT,
  ADD COLUMN "aiSummaryModel" TEXT,
  ADD COLUMN "aiSummaryProvider" TEXT,
  ADD COLUMN "aiSummaryAt" TIMESTAMP(3),
  ADD COLUMN "aiSummarySourceHash" TEXT;

-- Off-request summarization job queue (one job per session).
CREATE TABLE "SessionSummaryJob" (
  "id" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "sourceHash" TEXT NOT NULL,
  "lastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SessionSummaryJob_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SessionSummaryJob_sessionId_key" ON "SessionSummaryJob"("sessionId");
CREATE INDEX "SessionSummaryJob_status_idx" ON "SessionSummaryJob"("status");

ALTER TABLE "SessionSummaryJob"
  ADD CONSTRAINT "SessionSummaryJob_sessionId_fkey"
  FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Row-Level Security: scope through the session's campaign owner (matches the other tables).
ALTER TABLE "SessionSummaryJob" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "SessionSummaryJob owner access" ON "SessionSummaryJob"
  FOR ALL
  USING (EXISTS (
    SELECT 1 FROM "Session" s
    JOIN "Campaign" c ON c.id = s."campaignId"
    WHERE s.id = "SessionSummaryJob"."sessionId" AND c."ownerId" = auth.uid()::text
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM "Session" s
    JOIN "Campaign" c ON c.id = s."campaignId"
    WHERE s.id = "SessionSummaryJob"."sessionId" AND c."ownerId" = auth.uid()::text
  ));
