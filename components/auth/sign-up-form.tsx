"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { startTransition, useActionState, useState } from "react";
import { useForm } from "react-hook-form";

import { AuthStatus } from "@/components/auth/auth-shell";
import { CaptchaField } from "@/components/auth/captcha-field";
import { EmailField } from "@/components/auth/email-field";
import { PasswordField } from "@/components/auth/password-field";
import { Button } from "@/components/ui/button";
import { signUp, type AuthActionState } from "@/lib/auth/actions";
import { signUpSchema, type SignUpInput } from "@/lib/validation/auth";

const initial: AuthActionState = { ok: false };

export function SignUpForm() {
  const [state, dispatch, pending] = useActionState(signUp, initial);
  const [token, setToken] = useState("");
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignUpInput>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { email: "", password: "", confirmPassword: "" },
  });

  const onSubmit = handleSubmit((values) => {
    const fd = new FormData();
    fd.set("email", values.email);
    fd.set("password", values.password);
    fd.set("confirmPassword", values.confirmPassword);
    fd.set("captchaToken", token);
    startTransition(() => dispatch(fd));
  });

  // After a successful sign-up we show "check your email" rather than a signed-in view.
  if (state.ok && state.message) {
    return <AuthStatus message={state.message} />;
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <EmailField error={errors.email?.message} register={register("email")} />
      <PasswordField
        label="Password"
        autoComplete="new-password"
        error={errors.password?.message}
        register={register("password")}
      />
      <PasswordField
        label="Confirm password"
        autoComplete="new-password"
        error={errors.confirmPassword?.message}
        register={register("confirmPassword")}
      />
      <CaptchaField onToken={setToken} />
      <AuthStatus error={state.error} />
      <Button type="submit" disabled={pending} className="w-full">
        Create account
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/sign-in" className="underline underline-offset-4">
          Sign in
        </Link>
      </p>
    </form>
  );
}
