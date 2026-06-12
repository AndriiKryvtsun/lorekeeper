import { z } from "zod";

// `ownerNpcId` is optional; when present the data layer verifies the NPC is in the same
// campaign. An empty string from a "no owner" form select is treated as undefined.
export const createItemSchema = z.object({
  name: z.string().trim().min(1, "name is required"),
  description: z.string().trim().min(1).optional(),
  ownerNpcId: z
    .string()
    .trim()
    .min(1)
    .optional()
    .or(z.literal("").transform(() => undefined)),
});

export const updateItemSchema = createItemSchema
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: "at least one field must be provided",
  });

export type CreateItemInput = z.infer<typeof createItemSchema>;
export type UpdateItemInput = z.infer<typeof updateItemSchema>;
