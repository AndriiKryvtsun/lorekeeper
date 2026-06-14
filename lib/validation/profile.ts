import { z } from "zod";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .or(z.literal("").transform(() => undefined));

// Shared profile-edit schema. Intentionally has NO `userId` — the owner is always the session
// user (`ctx.user.id`), never client input. Used by the form (zodResolver) and the server.
export const updateProfileSchema = z.object({
  displayName: optionalText(80),
  bio: optionalText(500),
  locale: optionalText(20),
  timezone: optionalText(60),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
