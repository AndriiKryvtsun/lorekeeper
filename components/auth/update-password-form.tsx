"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { startTransition, useActionState } from "react";
import { useForm } from "react-hook-form";

import { AuthStatus } from "@/components/auth/auth-shell";
import { PasswordField } from "@/components/auth/password-field";
import { Button } from "@/components/ui/button";
import { updatePassword, type AuthActionState } from "@/lib/auth/actions";
import {
  resetPasswordSchema,
  type ResetPasswordInput,
} from "@/lib/validation/auth";

const initial: AuthActionState = { ok: false };

// Used by both the reset-password page (recovery session) and the account set-password
// form. The server action refuses without a valid session and signs out other sessions.
export function UpdatePasswordForm({
  submitLabel = "Update password",
}: {
  submitLabel?: string;
}) {
  const [state, dispatch, pending] = useActionState(updatePassword, initial);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  const onSubmit = handleSubmit((values) => {
    const fd = new FormData();
    fd.set("password", values.password);
    fd.set("confirmPassword", values.confirmPassword);
    startTransition(() => dispatch(fd));
  });

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <PasswordField
        label="New password"
        autoComplete="new-password"
        error={errors.password?.message}
        register={register("password")}
      />
      <PasswordField
        label="Confirm new password"
        autoComplete="new-password"
        error={errors.confirmPassword?.message}
        register={register("confirmPassword")}
      />
      <AuthStatus error={state.error} message={state.message} />
      <Button type="submit" disabled={pending} className="w-full">
        {submitLabel}
      </Button>
    </form>
  );
}
