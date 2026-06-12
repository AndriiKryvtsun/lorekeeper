import { z } from "zod";

// Minimum password length. MUST match the Supabase project's password policy (set in the
// Supabase dashboard). Supabase's default is 6; we require 8 — keep the dashboard aligned.
export const PASSWORD_MIN_LENGTH = 8;

// Email is normalized (trimmed + lowercased) so casing/whitespace never causes duplicates
// or mismatches. Used by every auth flow.
export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email("Enter a valid email address");

export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Password must be at least ${PASSWORD_MIN_LENGTH} characters`);

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password is required"),
});

const withConfirm = {
  password: passwordSchema,
  confirmPassword: z.string(),
};

const matchConfirm = (data: { password: string; confirmPassword: string }) =>
  data.password === data.confirmPassword;
const confirmIssue: { message: string; path: (string | number)[] } = {
  message: "Passwords do not match",
  path: ["confirmPassword"],
};

export const signUpSchema = z
  .object({ email: emailSchema, ...withConfirm })
  .refine(matchConfirm, confirmIssue);

export const resetRequestSchema = z.object({ email: emailSchema });

export const resetPasswordSchema = z
  .object(withConfirm)
  .refine(matchConfirm, confirmIssue);

export type SignInInput = z.infer<typeof signInSchema>;
export type SignUpInput = z.infer<typeof signUpSchema>;
export type ResetRequestInput = z.infer<typeof resetRequestSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
