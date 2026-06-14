import "server-only";

import type { Profile } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import type { UpdateProfileInput } from "@/lib/validation/profile";

// Owner-scoped profile access. `userId` is always the session user's id (never client input).

export function getProfile(userId: string): Promise<Profile | null> {
  return prisma.profile.findUnique({ where: { userId } });
}

export function upsertProfile(
  userId: string,
  data: UpdateProfileInput & { avatarUrl?: string | null },
): Promise<Profile> {
  return prisma.profile.upsert({
    where: { userId },
    create: { userId, ...data },
    update: { ...data },
  });
}

// Delete ALL of a user's owned application data. Campaigns cascade to their children; the
// profile row is removed too. Run before deleting the auth user.
export async function deleteOwnedData(userId: string): Promise<void> {
  await prisma.$transaction([
    prisma.campaign.deleteMany({ where: { ownerId: userId } }),
    prisma.profile.deleteMany({ where: { userId } }),
  ]);
}
