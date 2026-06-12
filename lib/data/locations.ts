import "server-only";

import type { Location } from "@/app/generated/prisma/client";
import { isOwnedCampaign } from "@/lib/data/owned";
import { prisma } from "@/lib/prisma";
import type {
  CreateLocationInput,
  UpdateLocationInput,
} from "@/lib/validation/location";

export async function listLocationsForOwner(
  ownerId: string,
  campaignId: string,
): Promise<Location[] | null> {
  if (!(await isOwnedCampaign(ownerId, campaignId))) return null;
  return prisma.location.findMany({
    where: { campaignId },
    orderBy: { name: "asc" },
  });
}

export async function createLocationForOwner(
  ownerId: string,
  campaignId: string,
  data: CreateLocationInput,
): Promise<Location | null> {
  if (!(await isOwnedCampaign(ownerId, campaignId))) return null;
  return prisma.location.create({ data: { ...data, campaignId } });
}

export async function updateLocationForOwner(
  ownerId: string,
  id: string,
  data: UpdateLocationInput,
): Promise<Location | null> {
  const { count } = await prisma.location.updateMany({
    where: { id, campaign: { ownerId } },
    data,
  });
  if (count === 0) return null;
  return prisma.location.findUnique({ where: { id } });
}

export async function deleteLocationForOwner(
  ownerId: string,
  id: string,
): Promise<boolean> {
  const { count } = await prisma.location.deleteMany({
    where: { id, campaign: { ownerId } },
  });
  return count > 0;
}
