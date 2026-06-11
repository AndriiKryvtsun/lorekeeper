"use client";

import { ErrorState } from "@/components/error-state";

// Catches errors thrown in the root layout. Must render its own <html>/<body>.
export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body>
        <div className="mx-auto w-full max-w-6xl px-4 py-10">
          <ErrorState
            title="Application error"
            description="A critical error occurred. Please reload."
            onRetry={reset}
          />
        </div>
      </body>
    </html>
  );
}
