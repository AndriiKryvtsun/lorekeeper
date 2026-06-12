import "server-only";

import type { Item } from "@/app/generated/prisma/client";
import { isOwnedCampaign } from "@/lib/data/owned";
import { prisma } from "@/lib/prisma";
import type { CreateItemInput, UpdateItemInput } from "@/lib/validation/item";

// Thrown when an item's `ownerNpcId` references an NPC outside the item's campaign. The
// router maps this to BAD_REQUEST. Keeping it distinct from the null "not found" result
// lets the API tell the two failure modes apart.
export class OwnerNpcNotInCampaignError extends Error {
  constructor() {
    super("ownerNpcId must reference an NPC in the same campaign");
    this.name = "OwnerNpcNotInCampaignError";
  }
}

async function assertOwnerNpcInCampaign(
  campaignId: string,
  ownerNpcId: string | undefined,
): Promise<void> {
  if (!ownerNpcId) return;
  const npc = await prisma.nPC.findFirst({
    where: { id: ownerNpcId, campaignId },
    select: { id: true },
  });
  if (!npc) throw new OwnerNpcNotInCampaignError();
}

export async function listItemsForOwner(
  ownerId: string,
  campaignId: string,
): Promise<Item[] | null> {
  if (!(await isOwnedCampaign(ownerId, campaignId))) return null;
  return prisma.item.findMany({
    where: { campaignId },
    orderBy: { name: "asc" },
  });
}

export async function createItemForOwner(
  ownerId: string,
  campaignId: string,
  data: CreateItemInput,
): Promise<Item | null> {
  if (!(await isOwnedCampaign(ownerId, campaignId))) return null;
  await assertOwnerNpcInCampaign(campaignId, data.ownerNpcId);
  return prisma.item.create({ data: { ...data, campaignId } });
}

export async function updateItemForOwner(
  ownerId: string,
  id: string,
  data: UpdateItemInput,
): Promise<Item | null> {
  // Confirm the item is under an owned campaign and learn its campaignId.
  const existing = await prisma.item.findFirst({
    where: { id, campaign: { ownerId } },
    select: { id: true, campaignId: true },
  });
  if (!existing) return null;
  await assertOwnerNpcInCampaign(existing.campaignId, data.ownerNpcId);
  return prisma.item.update({ where: { id }, data });
}

export async function deleteItemForOwner(
  ownerId: string,
  id: string,
): Promise<boolean> {
  const { count } = await prisma.item.deleteMany({
    where: { id, campaign: { ownerId } },
  });
  return count > 0;
}
