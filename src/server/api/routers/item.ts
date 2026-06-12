import { TRPCError } from "@trpc/server";
import { z } from "zod";

import {
  OwnerNpcNotInCampaignError,
  createItemForOwner,
  deleteItemForOwner,
  listItemsForOwner,
  updateItemForOwner,
} from "@/lib/data/items";
import { createItemSchema, updateItemSchema } from "@/lib/validation/item";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";

// Maps an invalid owner-NPC reference (NPC not in the same campaign) to BAD_REQUEST.
function mapItemError(error: unknown): never {
  if (error instanceof OwnerNpcNotInCampaignError) {
    throw new TRPCError({ code: "BAD_REQUEST", message: error.message });
  }
  throw error;
}

export const itemRouter = createTRPCRouter({
  listByCampaign: protectedProcedure
    .input(z.object({ campaignId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const rows = await listItemsForOwner(ctx.user.id, input.campaignId);
      if (rows === null) throw new TRPCError({ code: "NOT_FOUND" });
      return rows;
    }),

  create: protectedProcedure
    .input(createItemSchema.extend({ campaignId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const { campaignId, ...data } = input;
      try {
        const row = await createItemForOwner(ctx.user.id, campaignId, data);
        if (row === null) throw new TRPCError({ code: "NOT_FOUND" });
        return row;
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        return mapItemError(error);
      }
    }),

  update: protectedProcedure
    .input(z.object({ id: z.string().min(1), data: updateItemSchema }))
    .mutation(async ({ ctx, input }) => {
      try {
        const row = await updateItemForOwner(ctx.user.id, input.id, input.data);
        if (row === null) throw new TRPCError({ code: "NOT_FOUND" });
        return row;
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        return mapItemError(error);
      }
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const deleted = await deleteItemForOwner(ctx.user.id, input.id);
      if (!deleted) throw new TRPCError({ code: "NOT_FOUND" });
      return { id: input.id };
    }),
});
