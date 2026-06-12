import { TRPCError } from "@trpc/server";
import { z } from "zod";

import {
  createCharacterForOwner,
  deleteCharacterForOwner,
  listCharactersForOwner,
  updateCharacterForOwner,
} from "@/lib/data/characters";
import {
  createCharacterSchema,
  updateCharacterSchema,
} from "@/lib/validation/character";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";

export const characterRouter = createTRPCRouter({
  listByCampaign: protectedProcedure
    .input(z.object({ campaignId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const rows = await listCharactersForOwner(ctx.user.id, input.campaignId);
      if (rows === null) throw new TRPCError({ code: "NOT_FOUND" });
      return rows;
    }),

  create: protectedProcedure
    .input(createCharacterSchema.extend({ campaignId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const { campaignId, ...data } = input;
      const row = await createCharacterForOwner(ctx.user.id, campaignId, data);
      if (row === null) throw new TRPCError({ code: "NOT_FOUND" });
      return row;
    }),

  update: protectedProcedure
    .input(z.object({ id: z.string().min(1), data: updateCharacterSchema }))
    .mutation(async ({ ctx, input }) => {
      const row = await updateCharacterForOwner(
        ctx.user.id,
        input.id,
        input.data,
      );
      if (row === null) throw new TRPCError({ code: "NOT_FOUND" });
      return row;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const deleted = await deleteCharacterForOwner(ctx.user.id, input.id);
      if (!deleted) throw new TRPCError({ code: "NOT_FOUND" });
      return { id: input.id };
    }),
});
