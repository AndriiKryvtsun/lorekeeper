import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../app/generated/prisma/client";

// Standalone seed runner (invoked via `tsx prisma/seed.ts`). It builds its own client
// rather than importing lib/prisma.ts so it does not depend on the `@/` path alias.
// Seeding uses the direct connection when available, falling back to the pooled URL.
const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("Set DIRECT_URL or DATABASE_URL to seed the database");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

// Fixed IDs keep the seed idempotent: re-running upserts the same sample rows.
const CAMPAIGN_ID = "seed-campaign-emberfall";
const NPC_ID = "seed-npc-mara";
// Constant dev/seed owner id used to backfill pre-ownership rows (see the
// add_campaign_owner migration). Replace with a real auth user id when testing live auth.
const SEED_OWNER_ID = "00000000-0000-0000-0000-000000000000";

async function main() {
  await prisma.campaign.upsert({
    where: { id: CAMPAIGN_ID },
    update: {},
    create: {
      id: CAMPAIGN_ID,
      title: "The Emberfall Chronicles",
      system: "D&D 5e",
      description: "A sample campaign seeded for local development.",
      ownerId: SEED_OWNER_ID,
    },
  });

  await prisma.session.upsert({
    where: { id: "seed-session-1" },
    update: {},
    create: {
      id: "seed-session-1",
      title: "Session 1: Smoke on the Horizon",
      date: new Date("2026-01-15T18:00:00.000Z"),
      summary: "The party arrives in Emberfall and meets the innkeeper.",
      notes: "Players: be ready for the festival next session.",
      campaignId: CAMPAIGN_ID,
    },
  });

  await prisma.nPC.upsert({
    where: { id: NPC_ID },
    update: {},
    create: {
      id: NPC_ID,
      name: "Mara Quillfeather",
      role: "Innkeeper",
      description: "Runs the Gilded Ember tavern; knows every rumor in town.",
      status: "alive",
      campaignId: CAMPAIGN_ID,
    },
  });

  await prisma.location.upsert({
    where: { id: "seed-location-1" },
    update: {},
    create: {
      id: "seed-location-1",
      name: "The Gilded Ember",
      description: "A warm tavern at the heart of Emberfall.",
      campaignId: CAMPAIGN_ID,
    },
  });

  // Item owned by the seeded NPC (exercises the nullable ownerNpcId relation).
  await prisma.item.upsert({
    where: { id: "seed-item-1" },
    update: {},
    create: {
      id: "seed-item-1",
      name: "Brass Tavern Key",
      description: "Opens the cellar beneath the Gilded Ember.",
      campaignId: CAMPAIGN_ID,
      ownerNpcId: NPC_ID,
    },
  });

  await prisma.character.upsert({
    where: { id: "seed-character-1" },
    update: {},
    create: {
      id: "seed-character-1",
      name: "Sir Aldric",
      playerName: "Sam",
      class: "Paladin",
      level: 3,
      notes: "Sworn to the Order of the Dawn.",
      campaignId: CAMPAIGN_ID,
    },
  });

  console.log(`Seeded sample campaign ${CAMPAIGN_ID}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
