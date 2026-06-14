import "server-only";

import { getProvider, modelForTier } from "@/lib/ai/tiers";
import { prisma } from "@/lib/prisma";
import {
  buildSessionContent,
  computeSummarySourceHash,
  MAX_SUMMARY_ATTEMPTS,
  SUMMARY_SYSTEM,
} from "@/lib/summaries/source";
import { env } from "~/env";

const SUMMARY_MAX_OUTPUT_TOKENS = 400;

export type SummaryRunResult = {
  claimed: number;
  summarized: number;
  skipped: number;
  failed: number;
};

// Process a batch of pending summary jobs OFF the request path. Idempotent and retrying:
// jobs are claimed atomically (pending → processing), unchanged content is a no-op, and
// failures are re-queued with an attempt cap.
export async function processPendingSummaries(limit = 20): Promise<SummaryRunResult> {
  const result: SummaryRunResult = { claimed: 0, summarized: 0, skipped: 0, failed: 0 };

  const candidates = await prisma.sessionSummaryJob.findMany({
    where: { status: "pending", attempts: { lt: MAX_SUMMARY_ATTEMPTS } },
    orderBy: { createdAt: "asc" },
    take: limit,
    select: { id: true },
  });
  const ids = candidates.map((c) => c.id);
  if (ids.length === 0) return result;

  // Claim atomically: only rows still `pending` transition to `processing`, so a concurrent
  // worker run cannot grab the same job.
  await prisma.sessionSummaryJob.updateMany({
    where: { id: { in: ids }, status: "pending" },
    data: { status: "processing" },
  });
  result.claimed = ids.length;

  for (const id of ids) {
    const outcome = await processOne(id);
    result[outcome] += 1;
  }
  return result;
}

async function processOne(id: string): Promise<"summarized" | "skipped" | "failed"> {
  const job = await prisma.sessionSummaryJob.findUnique({
    where: { id },
    include: { session: true },
  });
  if (!job || job.status !== "processing" || !job.session) return "skipped";

  const session = job.session;
  const hash = computeSummarySourceHash(session);

  // Idempotent no-op: this content was already summarized.
  if (session.aiSummarySourceHash === hash) {
    await prisma.sessionSummaryJob.update({
      where: { id },
      data: { status: "done", sourceHash: hash, lastError: null },
    });
    return "skipped";
  }

  try {
    const { text } = await getProvider("answer").generate({
      system: SUMMARY_SYSTEM,
      messages: [{ role: "user", content: buildSessionContent(session) }],
      maxOutputTokens: SUMMARY_MAX_OUTPUT_TOKENS,
    });
    const summary = text.trim();
    await prisma.$transaction([
      prisma.session.update({
        where: { id: session.id },
        data: {
          aiSummary: summary,
          aiSummaryModel: modelForTier("answer"),
          aiSummaryProvider: env.AI_PROVIDER ?? "anthropic",
          aiSummaryAt: new Date(),
          aiSummarySourceHash: hash,
        },
      }),
      prisma.sessionSummaryJob.update({
        where: { id },
        data: { status: "done", sourceHash: hash, lastError: null },
      }),
    ]);
    return "summarized";
  } catch (error) {
    // Retry on a later run; mark failed once attempts are exhausted. The session's prior
    // summary is left intact.
    const attempts = job.attempts + 1;
    await prisma.sessionSummaryJob.update({
      where: { id },
      data: {
        attempts,
        status: attempts >= MAX_SUMMARY_ATTEMPTS ? "failed" : "pending",
        lastError: (error instanceof Error ? error.message : String(error)).slice(0, 500),
      },
    });
    return "failed";
  }
}
