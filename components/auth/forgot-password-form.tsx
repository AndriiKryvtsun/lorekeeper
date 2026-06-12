"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { startTransition, useActionState, useState } from "react";
import { useForm } from "react-hook-form";

import { AuthStatus } from "@/components/auth/auth-shell";
import { CaptchaField } from "@/components/auth/captcha-field";
import { EmailField } from "@/components/auth/email-field";
import { Button } from "@/components/ui/button";
import {
  resetPasswordForEmail,
  type AuthActionState,
} from "@/lib/auth/actions";
import { resetRequestSchema, type ResetRequestInput } from "@/lib/validation/auth";

const initial: AuthActionState = { ok: false };

export function ForgotPasswordForm() {
  const [state, dispatch, pending] = useActionState(
    resetPasswordForEmail,
    initial,
  );
  const [token, setToken] = useState("");
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetRequestInput>({
    resolver: zodResolver(resetRequestSchema),
    defaultValues: { email: "" },
  });

  const onSubmit = handleSubmit((values) => {
    const fd = new FormData();
    fd.set("email", values.email);
    fd.set("captchaToken", token);
    startTransition(() => dispatch(fd));
  });

  if (state.ok && state.message) {
    return <AuthStatus message={state.message} />;
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <EmailField error={errors.email?.message} register={register("email")} />
      <CaptchaField onToken={setToken} />
      <AuthStatus error={state.error} />
      <Button type="submit" disabled={pending} className="w-full">
        Send reset link
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        <Link href="/sign-in" className="underline underline-offset-4">
          Back to sign in
        </Link>
      </p>
    </form>
  );
}
