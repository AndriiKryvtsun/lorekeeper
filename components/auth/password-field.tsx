"use client";

import { Eye, EyeOff } from "lucide-react";
import { useId, useState } from "react";
import type { UseFormRegisterReturn } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Accessible password input with a show/hide toggle. The toggle exposes its state via
// aria-pressed; the input wires aria-invalid/aria-describedby to its error text.
export function PasswordField({
  label,
  error,
  autoComplete,
  register,
}: {
  label: string;
  error?: string;
  autoComplete: "current-password" | "new-password";
  register: UseFormRegisterReturn;
}) {
  const id = useId();
  const errorId = `${id}-error`;
  const [visible, setVisible] = useState(false);

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
          className="pr-10"
          {...register}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-pressed={visible}
          aria-label={visible ? "Hide password" : "Show password"}
          className="absolute right-0 top-0 h-9 w-9"
          onClick={() => setVisible((v) => !v)}
        >
          {visible ? (
            <EyeOff className="size-4" aria-hidden="true" />
          ) : (
            <Eye className="size-4" aria-hidden="true" />
          )}
        </Button>
      </div>
      {error ? (
        <p id={errorId} className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
