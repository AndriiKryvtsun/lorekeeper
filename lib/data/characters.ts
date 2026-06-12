import "server-only";

import type { Character } from "@/app/generated/prisma/client";
import { isOwnedCampaign } from "@/lib/data/owned";
import { prisma } from "@/lib/prisma";
import type {
  CreateCharacterInput,
  UpdateCharacterInput,
} from "@/lib/validation/character";

export async function listCharactersForOwner(
  ownerId: string,
  campaignId: string,
): Promise<Character[] | null> {
  if (!(await isOwnedCampaign(ownerId, campaignId))) return null;
  return prisma.character.findMany({
    where: { campaignId },
    orderBy: { name: "asc" },
  });
}

export async function createCharacterForOwner(
  ownerId: string,
  campaignId: string,
  data: CreateCharacterInput,
): Promise<Character | null> {
  if (!(await isOwnedCampaign(ownerId, campaignId))) return null;
  return prisma.character.create({ data: { ...data, campaignId } });
}

export async function updateCharacterForOwner(
  ownerId: string,
  id: string,
  data: UpdateCharacterInput,
): Promise<Character | null> {
  const { count } = await prisma.character.updateMany({
    where: { id, campaign: { ownerId } },
    data,
  });
  if (count === 0) return null;
  return prisma.character.findUnique({ where: { id } });
}

export async function deleteCharacterForOwner(
  ownerId: string,
  id: string,
): Promise<boolean> {
  const { count } = await prisma.character.deleteMany({
    where: { id, campaign: { ownerId } },
  });
  return count > 0;
}
