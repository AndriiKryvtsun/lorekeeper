import { z } from "zod";

export const createCharacterSchema = z.object({
  name: z.string().trim().min(1, "name is required"),
  playerName: z.string().trim().min(1, "player name is required"),
  class: z.string().trim().min(1, "class is required"),
  level: z.coerce.number().int().min(1, "level must be at least 1"),
  notes: z.string().trim().min(1).optional(),
});

export const updateCharacterSchema = createCharacterSchema
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: "at least one field must be provided",
  });

export type CreateCharacterInput = z.infer<typeof createCharacterSchema>;
export type UpdateCharacterInput = z.infer<typeof updateCharacterSchema>;
