import { TRPCError } from "@trpc/server";
import { z } from "zod";

import {
  createSessionForOwner,
  deleteSessionForOwner,
  listSessionsForOwner,
  updateSessionForOwner,
} from "@/lib/data/sessions";
import {
  createSessionSchema,
  updateSessionSchema,
} from "@/lib/validation/session";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";

// All procedures owner-scoped via the parent campaign; not-found → NOT_FOUND.
export const sessionRouter = createTRPCRouter({
  listByCampaign: protectedProcedure
    .input(z.object({ campaignId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const rows = await listSessionsForOwner(ctx.user.id, input.campaignId);
      if (rows === null) throw new TRPCError({ code: "NOT_FOUND" });
      return rows;
    }),

  create: protectedProcedure
    .input(createSessionSchema.extend({ campaignId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const { campaignId, ...data } = input;
      const row = await createSessionForOwner(ctx.user.id, campaignId, data);
      if (row === null) throw new TRPCError({ code: "NOT_FOUND" });
      return row;
    }),

  update: protectedProcedure
    .input(z.object({ id: z.string().min(1), data: updateSessionSchema }))
    .mutation(async ({ ctx, input }) => {
      const row = await updateSessionForOwner(ctx.user.id, input.id, input.data);
      if (row === null) throw new TRPCError({ code: "NOT_FOUND" });
      return row;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const deleted = await deleteSessionForOwner(ctx.user.id, input.id);
      if (!deleted) throw new TRPCError({ code: "NOT_FOUND" });
      return { id: input.id };
    }),
});
