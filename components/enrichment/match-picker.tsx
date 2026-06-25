"use client";

import { Button } from "@/components/ui/button";

// Accessible picker for the multiple-match case. A labelled group of real buttons — fully
// keyboard-operable; the parent decides what happens on pick/cancel.
export function EnrichMatchPicker({
  matches,
  onPick,
  onCancel,
}: {
  matches: string[];
  onPick: (index: number) => void;
  onCancel: () => void;
}) {
  return (
    <div role="group" aria-label="Choose a match" className="space-y-1.5">
      <p className="text-xs text-muted-foreground">
        Multiple matches — choose one:
      </p>
      <ul className="space-y-1">
        {matches.map((label, index) => (
          <li key={`${label}-${index}`}>
            <button
              type="button"
              onClick={() => onPick(index)}
              className="w-full rounded-md border border-border px-3 py-2 text-left text-sm transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {label}
            </button>
          </li>
        ))}
      </ul>
      <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
        Cancel
      </Button>
    </div>
  );
}
