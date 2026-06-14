// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AppShell } from "@/components/app-shell";
import { ThemeProvider } from "@/components/theme-provider";

function renderShell() {
  return render(
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
      <AppShell>
        <p>page content</p>
      </AppShell>
    </ThemeProvider>,
  );
}

describe("app shell landmarks and skip link", () => {
  it("exposes banner, navigation, and main landmarks", () => {
    renderShell();
    expect(screen.getByRole("banner")).toBeInTheDocument();
    expect(
      screen.getByRole("navigation", { name: "Primary" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("main")).toBeInTheDocument();
  });

  it("renders content within the main landmark", () => {
    renderShell();
    expect(screen.getByRole("main")).toHaveTextContent("page content");
  });

  it("provides a skip-to-content link targeting #main", () => {
    renderShell();
    const skip = screen.getByRole("link", { name: /skip to content/i });
    expect(skip).toHaveAttribute("href", "#main");
    // The main region is focusable as the skip target.
    expect(screen.getByRole("main")).toHaveAttribute("id", "main");
  });

  it("provides an accessible account-settings link in the primary nav", () => {
    renderShell();
    const account = screen.getByRole("link", { name: /account settings/i });
    expect(account).toHaveAttribute("href", "/account");
  });

  it("labels the account link with the display name when provided", () => {
    render(
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
        <AppShell displayName="Aria Stormborn">
          <p>page content</p>
        </AppShell>
      </ThemeProvider>,
    );
    const account = screen.getByRole("link", { name: /account settings/i });
    expect(account).toHaveTextContent("Aria Stormborn");
  });
});
