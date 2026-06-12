"use client";

import { useId } from "react";
import type { ReactElement } from "react";

import { Label } from "@/components/ui/label";

// Accessible field wrapper: associates a Label with its control and wires inline error
// text via aria-describedby/aria-invalid. The child render-prop receives the control id
// and the describedby id so any primitive can be used.
export function FormField({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: (props: {
    id: string;
    "aria-invalid": boolean;
    "aria-describedby": string | undefined;
  }) => ReactElement;
}) {
  const id = useId();
  const errorId = `${id}-error`;
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children({
        id,
        "aria-invalid": Boolean(error),
        "aria-describedby": error ? errorId : undefined,
      })}
      {error ? (
        <p id={errorId} className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
