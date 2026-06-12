"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  resetPasswordSchema,
  resetRequestSchema,
  signInSchema,
  signUpSchema,
} from "@/lib/validation/auth";

// Generic, enumeration-safe messages. We NEVER reveal whether an email exists, and never
// log credentials, tokens, or existence signals.
const GENERIC_CHECK_EMAIL = "Check your email to continue.";
const GENERIC_SIGNIN_ERROR = "Invalid email or password.";
const CAPTCHA_REQUIRED = "Captcha verification is required. Please try again.";

export type AuthActionState = {
  ok: boolean;
  error?: string;
  message?: string;
};

function firstError(issues: { message: string }[]): string {
  return issues[0]?.message ?? "Invalid input";
}

function captchaToken(formData: FormData): string {
  const token = formData.get("captchaToken");
  return typeof token === "string" ? token.trim() : "";
}

async function baseUrl(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "https";
  return `${proto}://${host}`;
}

// Sign up with email + password. Enumeration-safe: regardless of whether the email already
// exists, a successful attempt returns the identical generic "check your email" result.
export async function signUp(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = signUpSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) {
    return { ok: false, error: firstError(parsed.error.issues) };
  }
  const token = captchaToken(formData);
  if (!token) return { ok: false, error: CAPTCHA_REQUIRED };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      emailRedirectTo: `${await baseUrl()}/auth/confirm`,
      captchaToken: token,
    },
  });
  // A genuine error here is captcha/rate-limit/policy — NOT existence (Supabase does not
  // error for an existing email). Surface a generic, existence-agnostic message.
  if (error) {
    return { ok: false, error: "Could not complete sign-up. Please try again." };
  }
  return { ok: true, message: GENERIC_CHECK_EMAIL };
}

// Sign in with email + password. Any failure maps to one generic message.
export async function signInWithPassword(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { ok: false, error: GENERIC_SIGNIN_ERROR };

  const token = captchaToken(formData);
  if (!token) return { ok: false, error: CAPTCHA_REQUIRED };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
    options: { captchaToken: token },
  });
  if (error) return { ok: false, error: GENERIC_SIGNIN_ERROR };

  redirect("/campaigns");
}

// Send a magic link (secondary method).
export async function signInWithMagicLink(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = resetRequestSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    return { ok: false, error: firstError(parsed.error.issues) };
  }
  const token = captchaToken(formData);
  if (!token) return { ok: false, error: CAPTCHA_REQUIRED };

  const supabase = await createSupabaseServerClient();
  await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: {
      emailRedirectTo: `${await baseUrl()}/auth/callback`,
      captchaToken: token,
    },
  });
  return { ok: true, message: GENERIC_CHECK_EMAIL };
}

// Request a password reset. Enumeration-safe: identical generic result for any email.
export async function resetPasswordForEmail(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = resetRequestSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    return { ok: false, error: firstError(parsed.error.issues) };
  }
  const token = captchaToken(formData);
  if (!token) return { ok: false, error: CAPTCHA_REQUIRED };

  const supabase = await createSupabaseServerClient();
  // Result is intentionally ignored so existence is never revealed.
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${await baseUrl()}/auth/confirm?next=/reset-password`,
    captchaToken: token,
  });
  return { ok: true, message: GENERIC_CHECK_EMAIL };
}

// Set/update the password. Requires a valid (recovery or authenticated) session; refuses
// otherwise. On success, signs out other sessions (global scope) per policy.
export async function updatePassword(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = resetPasswordSchema.safeParse({
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) {
    return { ok: false, error: firstError(parsed.error.issues) };
  }

  const user = await getCurrentUser();
  if (!user) {
    return {
      ok: false,
      error: "Your reset link is invalid or has expired. Request a new one.",
    };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });
  if (error) {
    return { ok: false, error: "Could not update your password. Please try again." };
  }
  // Invalidate all sessions after a password change.
  await supabase.auth.signOut({ scope: "global" });
  redirect("/sign-in?reset=success");
}

export async function signOut(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/sign-in");
}
