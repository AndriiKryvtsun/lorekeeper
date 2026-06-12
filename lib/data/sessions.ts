import "server-only";

import type { Session } from "@/app/generated/prisma/client";
import { isOwnedCampaign } from "@/lib/data/owned";
import { prisma } from "@/lib/prisma";
import type {
  CreateSessionInput,
  UpdateSessionInput,
} from "@/lib/validation/session";

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
  return prisma.session.create({ data: { ...data, campaignId } });
}

export async function updateSessionForOwner(
  ownerId: string,
  id: string,
  data: UpdateSessionInput,
): Promise<Session | null> {
  const { count } = await prisma.session.updateMany({
    where: { id, campaign: { ownerId } },
    data,
  });
  if (count === 0) return null;
  return prisma.session.findUnique({ where: { id } });
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
