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
import {
  signInWithPassword,
  type AuthActionState,
} from "@/lib/auth/actions";
import { signInSchema, type SignInInput } from "@/lib/validation/auth";

const initial: AuthActionState = { ok: false };

export function SignInForm() {
  const [state, dispatch, pending] = useActionState(signInWithPassword, initial);
  const [token, setToken] = useState("");
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignInInput>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = handleSubmit((values) => {
    const fd = new FormData();
    fd.set("email", values.email);
    fd.set("password", values.password);
    fd.set("captchaToken", token);
    startTransition(() => dispatch(fd));
  });

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <EmailField error={errors.email?.message} register={register("email")} />
      <PasswordField
        label="Password"
        autoComplete="current-password"
        error={errors.password?.message}
        register={register("password")}
      />
      <CaptchaField onToken={setToken} />
      <AuthStatus error={state.error} />
      <Button type="submit" disabled={pending} className="w-full">
        Sign in
      </Button>
      <div className="flex justify-end text-sm">
        <Link href="/forgot-password" className="underline underline-offset-4">
          Forgot password?
        </Link>
      </div>
      <p className="text-center text-sm text-muted-foreground">
        No account?{" "}
        <Link href="/sign-up" className="underline underline-offset-4">
          Sign up
        </Link>
      </p>
    </form>
  );
}
