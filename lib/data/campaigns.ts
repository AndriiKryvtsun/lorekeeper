import "server-only";

import type { Campaign, NPC } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import type { CreateCampaignInput, UpdateCampaignInput } from "@/lib/validation/campaign";
import type { CreateNpcInput } from "@/lib/validation/npc";

// Owner-scoped data access. EVERY query is parameterized by the owner's id so a user can
// never read or write another user's data. Callers pass `ownerId` from the session — it
// is never derived from request input. A wrong-owner or absent row is reported as
// not-found (null / false), which handlers map to 404.

export async function listCampaigns(ownerId: string): Promise<Campaign[]> {
  return prisma.campaign.findMany({
    where: { ownerId },
    orderBy: { createdAt: "desc" },
  });
}

export async function getCampaign(
  ownerId: string,
  id: string,
): Promise<Campaign | null> {
  return prisma.campaign.findFirst({ where: { id, ownerId } });
}

export async function createCampaign(
  ownerId: string,
  data: CreateCampaignInput,
): Promise<Campaign> {
  return prisma.campaign.create({ data: { ...data, ownerId } });
}

export async function updateCampaign(
  ownerId: string,
  id: string,
  data: UpdateCampaignInput,
): Promise<Campaign | null> {
  // Confirm ownership first; only then update by primary key.
  const owned = await prisma.campaign.findFirst({
    where: { id, ownerId },
    select: { id: true },
  });
  if (!owned) return null;
  return prisma.campaign.update({ where: { id }, data });
}

export async function deleteCampaign(
  ownerId: string,
  id: string,
): Promise<boolean> {
  // deleteMany scopes by owner atomically and reports whether a row matched.
  const { count } = await prisma.campaign.deleteMany({ where: { id, ownerId } });
  return count > 0;
}

// NPC access first resolves an owned parent campaign; if the campaign is missing or owned
// by someone else, the result is not-found (null) and no NPC rows are touched.

export async function listNpcsForOwnedCampaign(
  ownerId: string,
  campaignId: string,
): Promise<NPC[] | null> {
  const owned = await prisma.campaign.findFirst({
    where: { id: campaignId, ownerId },
    select: { id: true },
  });
  if (!owned) return null;
  return prisma.nPC.findMany({
    where: { campaignId },
    orderBy: { name: "asc" },
  });
}

export async function createNpcForOwnedCampaign(
  ownerId: string,
  campaignId: string,
  data: CreateNpcInput,
): Promise<NPC | null> {
  const owned = await prisma.campaign.findFirst({
    where: { id: campaignId, ownerId },
    select: { id: true },
  });
  if (!owned) return null;
  // Parent comes from the path/owned campaign, never from the body.
  return prisma.nPC.create({ data: { ...data, campaignId } });
}
