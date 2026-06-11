import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

// Loading placeholder. The pulse animation is automatically minimized under
// prefers-reduced-motion via the global guard in globals.css.
export function Skeleton({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-muted", className)}
      {...props}
    />
  );
}
