import "server-only";

import type { Prisma, Session } from "@/app/generated/prisma/client";
import { isOwnedCampaign } from "@/lib/data/owned";
import { prisma } from "@/lib/prisma";
import { computeSummarySourceHash } from "@/lib/summaries/source";
import type {
  CreateSessionInput,
  UpdateSessionInput,
} from "@/lib/validation/session";

// Upsert the summary job for a session (one per session). Fast, provider-free — summarization
// happens later, off the request path, in the cron worker. Re-enqueuing resets it to pending
// so changed content is re-summarized.
async function enqueueSummaryJob(
  tx: Prisma.TransactionClient,
  session: Session,
): Promise<void> {
  const sourceHash = computeSummarySourceHash(session);
  await tx.sessionSummaryJob.upsert({
    where: { sessionId: session.id },
    create: { sessionId: session.id, sourceHash, status: "pending", attempts: 0 },
    update: { sourceHash, status: "pending", attempts: 0, lastError: null },
  });
}

// All functions are owner-scoped via the parent campaign. A missing/unowned campaign or
// target row is reported as not-found (null / false), which the router maps to NOT_FOUND.

export async function listSessionsForOwner(
  ownerId: string,
  campaignId: string,
): Promise<Session[] | null> {
  if (!(await isOwnedCampaign(ownerId, campaignId))) return null;
  return prisma.session.findMany({
    where: { campaignId },
    orderBy: { date: "desc" },
  });
}

export async function createSessionForOwner(
  ownerId: string,
  campaignId: string,
  data: CreateSessionInput,
): Promise<Session | null> {
  if (!(await isOwnedCampaign(ownerId, campaignId))) return null;
  // Create + enqueue summarization atomically. NO provider call here — summarization runs
  // later, off the request path.
  return prisma.$transaction(async (tx) => {
    const session = await tx.session.create({ data: { ...data, campaignId } });
    await enqueueSummaryJob(tx, session);
    return session;
  });
}

export async function updateSessionForOwner(
  ownerId: string,
  id: string,
  data: UpdateSessionInput,
): Promise<Session | null> {
  return prisma.$transaction(async (tx) => {
    const { count } = await tx.session.updateMany({
      where: { id, campaign: { ownerId } },
      data,
    });
    if (count === 0) return null;
    const session = await tx.session.findUnique({ where: { id } });
    if (!session) return null;
    // Re-enqueue so the (possibly changed) content is re-summarized off the request path.
    await enqueueSummaryJob(tx, session);
    return session;
  });
}

export async function deleteSessionForOwner(
  ownerId: string,
  id: string,
): Promise<boolean> {
  const { count } = await prisma.session.deleteMany({
    where: { id, campaign: { ownerId } },
  });
  return count > 0;
}
