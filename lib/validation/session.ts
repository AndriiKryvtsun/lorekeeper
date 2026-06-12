import { z } from "zod";

// Untrusted input for a Session. `campaignId` is never accepted here — the parent comes
// from the procedure input path. `date` is coerced from an ISO string (forms submit
// strings) into a Date.
export const createSessionSchema = z.object({
  title: z.string().trim().min(1, "title is required"),
  date: z.coerce.date({ message: "a valid date is required" }),
  summary: z.string().trim().min(1).optional(),
  notes: z.string().trim().min(1).optional(),
});

export const updateSessionSchema = createSessionSchema
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: "at least one field must be provided",
  });

export type CreateSessionInput = z.infer<typeof createSessionSchema>;
export type UpdateSessionInput = z.infer<typeof updateSessionSchema>;
