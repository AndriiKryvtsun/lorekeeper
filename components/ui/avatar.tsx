"use client";

import * as AvatarPrimitive from "@radix-ui/react-avatar";
import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

// Radix avatar: shows the image when it loads, otherwise the fallback (e.g. initials).
export function Avatar({
  className,
  ...props
}: ComponentProps<typeof AvatarPrimitive.Root>) {
  return (
    <AvatarPrimitive.Root
      className={cn(
        "relative flex size-8 shrink-0 overflow-hidden rounded-full",
        className,
      )}
      {...props}
    />
  );
}

export function AvatarImage({
  className,
  ...props
}: ComponentProps<typeof AvatarPrimitive.Image>) {
  return (
    <AvatarPrimitive.Image
      className={cn("aspect-square size-full object-cover", className)}
      {...props}
    />
  );
}

export function AvatarFallback({
  className,
  ...props
}: ComponentProps<typeof AvatarPrimitive.Fallback>) {
  return (
    <AvatarPrimitive.Fallback
      className={cn(
        "bg-arcane-gradient flex size-full items-center justify-center rounded-full text-xs font-medium text-arcane-foreground",
        className,
      )}
      {...props}
    />
  );
}
