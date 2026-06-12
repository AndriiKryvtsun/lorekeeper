import { TRPCError } from "@trpc/server";
import { z } from "zod";

import {
  createNpcForOwnedCampaign,
  deleteNpcForOwner,
  listNpcsForOwnedCampaign,
  updateNpcForOwner,
} from "@/lib/data/campaigns";
import { createNpcSchema, updateNpcSchema } from "@/lib/validation/npc";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";

// NPC procedures operate only under a campaign owned by ctx.user.id. The parent is the
// input campaignId; a missing or unowned campaign/row maps to NOT_FOUND.
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

  update: protectedProcedure
    .input(z.object({ id: z.string().min(1), data: updateNpcSchema }))
    .mutation(async ({ ctx, input }) => {
      const npc = await updateNpcForOwner(ctx.user.id, input.id, input.data);
      if (npc === null) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      return npc;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const deleted = await deleteNpcForOwner(ctx.user.id, input.id);
      if (!deleted) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      return { id: input.id };
    }),
});
