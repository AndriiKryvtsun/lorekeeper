import "server-only";

import { prisma } from "@/lib/prisma";

// Returns true when the campaign exists and is owned by `ownerId`. Child data modules call
// this before listing/creating, and use relation filters (`campaign: { ownerId }`) for
// update/delete so every child operation is owner-scoped.
export async function isOwnedCampaign(
  ownerId: string,
  campaignId: string,
): Promise<boolean> {
  const owned = await prisma.campaign.findFirst({
    where: { id: campaignId, ownerId },
    select: { id: true },
  });
  return owned !== null;
}
