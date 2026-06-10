import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, describe, expect, it } from "vitest";

import { PrismaClient } from "@/app/generated/prisma/client";

// Opt-in/local only: runs against a real Postgres via DIRECT_URL when set, otherwise
// the whole suite is skipped (there is no CI database). Uses throwaway ids so it does
// not collide with seeded sample data.
const connectionString = process.env.DIRECT_URL;

const prisma = connectionString
  ? new PrismaClient({ adapter: new PrismaPg({ connectionString }) })
  : null;

const PREFIX = "itest-";

describe.skipIf(!connectionString)("data-foundation DB integrity", () => {
  afterAll(async () => {
    if (!prisma) return;
    // Deleting the campaign cascades to all remaining children.
    await prisma.campaign.deleteMany({ where: { id: { startsWith: PREFIX } } });
    await prisma.$disconnect();
  });

  it("clears Item.ownerNpcId when the owning NPC is deleted (SetNull)", async () => {
    const db = prisma!;
    const campaign = await db.campaign.create({
      data: { id: `${PREFIX}c1`, title: "ITest", system: "D&D 5e", ownerId: `${PREFIX}owner` },
    });
    const npc = await db.nPC.create({
      data: { id: `${PREFIX}n1`, name: "Owner", status: "alive", campaignId: campaign.id },
    });
    const item = await db.item.create({
      data: { id: `${PREFIX}i1`, name: "Sword", campaignId: campaign.id, ownerNpcId: npc.id },
    });

    await db.nPC.delete({ where: { id: npc.id } });

    const after = await db.item.findUnique({ where: { id: item.id } });
    expect(after).not.toBeNull();
    expect(after?.ownerNpcId).toBeNull();
  });

  it("cascades child deletes when the campaign is deleted", async () => {
    const db = prisma!;
    const campaign = await db.campaign.create({
      data: { id: `${PREFIX}c2`, title: "ITest2", system: "D&D 5e", ownerId: `${PREFIX}owner` },
    });
    await db.session.create({
      data: {
        id: `${PREFIX}s1`,
        title: "S1",
        date: new Date("2026-01-01T00:00:00.000Z"),
        campaignId: campaign.id,
      },
    });

    await db.campaign.delete({ where: { id: campaign.id } });

    const session = await db.session.findUnique({ where: { id: `${PREFIX}s1` } });
    expect(session).toBeNull();
  });
});
