import { z } from "zod";

export const createLocationSchema = z.object({
  name: z.string().trim().min(1, "name is required"),
  description: z.string().trim().min(1).optional(),
});

export const updateLocationSchema = createLocationSchema
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: "at least one field must be provided",
  });

export type CreateLocationInput = z.infer<typeof createLocationSchema>;
export type UpdateLocationInput = z.infer<typeof updateLocationSchema>;
