import { Sparkles, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

// Reusable empty placeholder for views with no data. The icon sits inside a decorative,
// arcane gradient medallion (purely presentational — marked aria-hidden). Optional title,
// description, and an action (e.g. a "Create" Button).
export function EmptyState({
  icon: Icon = Sparkles,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "lk-animate-rise flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-border bg-card/40 p-10 text-center",
        className,
      )}
    >
      {/* Decorative medallion: gradient ring + soft arcane glow behind the icon. */}
      <div
        aria-hidden="true"
        className="bg-arcane-gradient flex size-14 items-center justify-center rounded-full text-arcane-foreground shadow-glow"
      >
        <Icon className="size-7" />
      </div>
      <div className="space-y-1">
        <p className="text-lg font-medium">{title}</p>
        {description ? (
          <p className="mx-auto max-w-sm text-sm text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      {action}
    </div>
  );
}
