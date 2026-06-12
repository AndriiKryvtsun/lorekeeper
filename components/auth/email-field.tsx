"use client";

import { useId } from "react";
import type { UseFormRegisterReturn } from "react-hook-form";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function EmailField({
  error,
  register,
  label = "Email",
}: {
  error?: string;
  register: UseFormRegisterReturn;
  label?: string;
}) {
  const id = useId();
  const errorId = `${id}-error`;
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="email"
        autoComplete="email"
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
        {...register}
      />
      {error ? (
        <p id={errorId} className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
