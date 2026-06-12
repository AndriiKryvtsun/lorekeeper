import { TRPCError } from "@trpc/server";
import { z } from "zod";

import {
  createLocationForOwner,
  deleteLocationForOwner,
  listLocationsForOwner,
  updateLocationForOwner,
} from "@/lib/data/locations";
import {
  createLocationSchema,
  updateLocationSchema,
} from "@/lib/validation/location";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";

export const locationRouter = createTRPCRouter({
  listByCampaign: protectedProcedure
    .input(z.object({ campaignId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const rows = await listLocationsForOwner(ctx.user.id, input.campaignId);
      if (rows === null) throw new TRPCError({ code: "NOT_FOUND" });
      return rows;
    }),

  create: protectedProcedure
    .input(createLocationSchema.extend({ campaignId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const { campaignId, ...data } = input;
      const row = await createLocationForOwner(ctx.user.id, campaignId, data);
      if (row === null) throw new TRPCError({ code: "NOT_FOUND" });
      return row;
    }),

  update: protectedProcedure
    .input(z.object({ id: z.string().min(1), data: updateLocationSchema }))
    .mutation(async ({ ctx, input }) => {
      const row = await updateLocationForOwner(ctx.user.id, input.id, input.data);
      if (row === null) throw new TRPCError({ code: "NOT_FOUND" });
      return row;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const deleted = await deleteLocationForOwner(ctx.user.id, input.id);
      if (!deleted) throw new TRPCError({ code: "NOT_FOUND" });
      return { id: input.id };
    }),
});
