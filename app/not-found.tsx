import { FileQuestion } from "lucide-react";
import Link from "next/link";

import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";

// Rendered for unmatched routes, within the shared design system.
export default function NotFound() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10">
      <EmptyState
        icon={FileQuestion}
        title="Page not found"
        description="The page you're looking for doesn't exist or was moved."
        action={
          <Button asChild variant="outline">
            <Link href="/">Back to home</Link>
          </Button>
        }
      />
    </div>
  );
}
