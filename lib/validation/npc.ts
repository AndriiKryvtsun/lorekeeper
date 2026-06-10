import { z } from "zod";

// Untrusted request body for creating an NPC under a campaign. Unknown keys are stripped
// (Zod object default). `campaignId` is intentionally NOT accepted here — the parent is
// taken from the route path, never from the body.
export const createNpcSchema = z.object({
  name: z.string().trim().min(1, "name is required"),
  role: z.string().trim().min(1).optional(),
  description: z.string().trim().min(1).optional(),
  // `status` is NOT NULL in the data model; default to "alive" when omitted.
  status: z.string().trim().min(1).default("alive"),
});

export type CreateNpcInput = z.infer<typeof createNpcSchema>;
