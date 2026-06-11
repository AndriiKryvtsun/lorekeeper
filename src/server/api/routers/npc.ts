import { TRPCError } from "@trpc/server";
import { z } from "zod";

import {
  createNpcForOwnedCampaign,
  listNpcsForOwnedCampaign,
} from "@/lib/data/campaigns";
import { createNpcSchema } from "@/lib/validation/npc";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";

// NPC procedures operate only under a campaign owned by ctx.user.id. The parent is the
// input campaignId; a missing or unowned campaign maps to NOT_FOUND.
export const npcRouter = createTRPCRouter({
  listByCampaign: protectedProcedure
    .input(z.object({ campaignId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const npcs = await listNpcsForOwnedCampaign(ctx.user.id, input.campaignId);
      if (npcs === null) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      return npcs;
    }),

  create: protectedProcedure
    .input(createNpcSchema.extend({ campaignId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const { campaignId, ...data } = input;
      const npc = await createNpcForOwnedCampaign(ctx.user.id, campaignId, data);
      if (npc === null) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      return npc;
    }),
});
