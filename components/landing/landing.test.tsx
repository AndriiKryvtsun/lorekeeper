// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Landing } from "@/components/landing/landing";
import { ThemeProvider } from "@/components/theme-provider";

function renderLanding() {
  return render(
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
      <Landing />
    </ThemeProvider>,
  );
}

describe("Landing", () => {
  it("has exactly one h1", () => {
    renderLanding();
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  });

  it("exposes header/nav/main/footer landmarks", () => {
    renderLanding();
    expect(screen.getByRole("banner")).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Primary" })).toBeInTheDocument();
    expect(screen.getByRole("main")).toHaveAttribute("id", "main");
    expect(screen.getByRole("contentinfo")).toBeInTheDocument();
  });

  it("provides a skip-to-content link targeting #main", () => {
    renderLanding();
    expect(
      screen.getByRole("link", { name: /skip to content/i }),
    ).toHaveAttribute("href", "#main");
  });

  it("renders primary CTAs to /sign-up and /sign-in", () => {
    renderLanding();
    expect(screen.getByRole("link", { name: /get started/i })).toHaveAttribute(
      "href",
      "/sign-up",
    );
    // Two sign-in links (header + hero); both point to /sign-in.
    const signIn = screen.getAllByRole("link", { name: /sign in/i });
    expect(signIn.length).toBeGreaterThanOrEqual(1);
    for (const link of signIn) expect(link).toHaveAttribute("href", "/sign-in");
  });

  it("gives every image an alt attribute (decorative imagery uses empty alt)", () => {
    const { container } = renderLanding();
    const imgs = container.querySelectorAll("img");
    expect(imgs.length).toBeGreaterThan(0);
    for (const img of imgs) expect(img.getAttribute("alt")).not.toBeNull();
  });
});
