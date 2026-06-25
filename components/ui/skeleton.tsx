import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

// Loading placeholder with a refined left-to-right shimmer (transform-only). The shimmer is
// automatically neutralized under prefers-reduced-motion via the global guard in globals.css.
export function Skeleton({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn("lk-skeleton rounded-md bg-muted", className)}
      {...props}
    />
  );
}
