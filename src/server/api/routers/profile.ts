import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { getProfile, upsertProfile } from "@/lib/data/profile";
import { avatarExtension, isAllowedAvatarMime } from "@/lib/validation/avatar";
import { updateProfileSchema } from "@/lib/validation/profile";
import { env } from "~/env";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";

// Everything here is the current user's OWN data: the userId is ALWAYS `ctx.user.id`, never an
// input. There is no procedure that accepts a foreign userId.
export const profileRouter = createTRPCRouter({
  getMyProfile: protectedProcedure.query(({ ctx }) => getProfile(ctx.user.id)),

  updateMyProfile: protectedProcedure
    .input(updateProfileSchema)
    .mutation(({ ctx, input }) => upsertProfile(ctx.user.id, input)),

  // Confirm an uploaded avatar. The client uploads to its own RLS-scoped folder; the server
  // RE-validates the content type and DERIVES the stored path from `ctx.user.id` (never trusts
  // a client-supplied path) before persisting the URL.
  setAvatar: protectedProcedure
    .input(z.object({ contentType: z.string() }))
    .mutation(async ({ ctx, input }) => {
      if (!isAllowedAvatarMime(input.contentType)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Unsupported image type" });
      }
      const path = `${ctx.user.id}/avatar.${avatarExtension(input.contentType)}`;
      const avatarUrl = `${env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/avatars/${path}`;
      return upsertProfile(ctx.user.id, { avatarUrl });
    }),
});
