import { TRPCError } from "@trpc/server";
import { z } from "zod";

import {
  createCampaign,
  deleteCampaign,
  getCampaign,
  listCampaigns,
  updateCampaign,
} from "@/lib/data/campaigns";
import {
  createCampaignSchema,
  updateCampaignSchema,
} from "@/lib/validation/campaign";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";

// All procedures are protected and scoped to ctx.user.id. The owner is never taken from
// input. A not-found result from the owner-scoped data layer (missing OR unowned) maps to
// NOT_FOUND so existence is not revealed.
export const campaignRouter = createTRPCRouter({
  list: protectedProcedure.query(({ ctx }) => listCampaigns(ctx.user.id)),

  byId: protectedProcedure
    .input(z.object({ id: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const campaign = await getCampaign(ctx.user.id, input.id);
      if (!campaign) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      return campaign;
    }),

  create: protectedProcedure
    .input(createCampaignSchema)
    .mutation(({ ctx, input }) => createCampaign(ctx.user.id, input)),

  update: protectedProcedure
    .input(z.object({ id: z.string().min(1), data: updateCampaignSchema }))
    .mutation(async ({ ctx, input }) => {
      const campaign = await updateCampaign(ctx.user.id, input.id, input.data);
      if (!campaign) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      return campaign;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const deleted = await deleteCampaign(ctx.user.id, input.id);
      if (!deleted) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      return { id: input.id };
    }),
});
