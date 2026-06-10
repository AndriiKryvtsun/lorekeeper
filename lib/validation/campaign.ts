import { z } from "zod";

// Request bodies are UNTRUSTED. We validate at the boundary and `.strip()` unknown keys
// (the Zod object default) so stray fields never reach Prisma.
export const createCampaignSchema = z.object({
  title: z.string().trim().min(1, "title is required"),
  system: z.string().trim().min(1, "system is required"),
  description: z.string().trim().min(1).optional(),
});

// Partial update: any subset of the creatable fields, but at least one must be present.
export const updateCampaignSchema = createCampaignSchema
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: "at least one field must be provided",
  });

export type CreateCampaignInput = z.infer<typeof createCampaignSchema>;
export type UpdateCampaignInput = z.infer<typeof updateCampaignSchema>;
