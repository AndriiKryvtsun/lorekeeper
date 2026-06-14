import { z } from "zod";

// Reauthentication is required for sensitive account actions. We model reauth as re-entering
// the current password (verified server-side); magic-link users set a password first.
//
// Account deletion requires BOTH a typed email confirmation (matched server-side against the
// user's current email) and reauthentication.
export const deleteAccountSchema = z.object({
  confirmEmail: z.string().trim().toLowerCase().email("Enter your account email to confirm"),
  currentPassword: z.string().min(1, "Your current password is required"),
});
export type DeleteAccountInput = z.infer<typeof deleteAccountSchema>;
