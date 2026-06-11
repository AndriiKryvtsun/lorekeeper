"use client";

import { ErrorState } from "@/components/error-state";

// Route-segment error boundary (auto-wired by Next). Delegates to the shared ErrorState
// with a retry that calls Next's `reset`.
export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10">
      <ErrorState onRetry={reset} />
    </div>
  );
}
