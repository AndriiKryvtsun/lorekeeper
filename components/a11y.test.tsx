// @vitest-environment jsdom
import { render } from "@testing-library/react";
import type { ReactElement } from "react";
import { describe, expect, it } from "vitest";
import { axe } from "vitest-axe";

import { AppShell } from "@/components/app-shell";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { ThemeProvider } from "@/components/theme-provider";
import { Skeleton } from "@/components/ui/skeleton";

// Automated a11y smoke check on key UI, asserting axe reports zero violations. The `region`
// rule is disabled because these are rendered fragments, not whole documents — landmark
// coverage for the shell is asserted structurally in app-shell.test.tsx. Color-contrast is
// verified separately, from tokens, in globals-contrast.test.ts (axe cannot compute contrast
// under jsdom).
async function expectNoA11yViolations(ui: ReactElement) {
  const { container } = render(
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
      {ui}
    </ThemeProvider>,
  );
  const results = await axe(container, {
    rules: { region: { enabled: false } },
  });
  expect(results.violations).toEqual([]);
}

describe("automated a11y checks on key screens", () => {
  it("app shell has no violations", async () => {
    await expectNoA11yViolations(
      <AppShell displayName="Aria Stormborn" email="aria@example.com">
        <h1>Campaigns</h1>
        <p>Content</p>
      </AppShell>,
    );
  });

  it("empty state has no violations", async () => {
    await expectNoA11yViolations(
      <EmptyState
        title="No campaigns yet"
        description="Create your first campaign to get started."
      />,
    );
  });

  it("error state has no violations", async () => {
    await expectNoA11yViolations(<ErrorState />);
  });

  it("skeleton has no violations", async () => {
    await expectNoA11yViolations(<Skeleton className="h-6 w-40" />);
  });
});
