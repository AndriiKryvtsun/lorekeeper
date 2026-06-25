// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { ThemeProvider } from "@/components/theme-provider";
import { UserMenu } from "@/components/user-menu";

function renderMenu() {
  return render(
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
      <UserMenu
        displayName="Aria Stormborn"
        email="aria@example.com"
        avatarUrl={null}
      />
    </ThemeProvider>,
  );
}

describe("user menu", () => {
  it("trigger exposes menu semantics (collapsed by default)", () => {
    renderMenu();
    const trigger = screen.getByRole("button", { name: /open user menu/i });
    expect(trigger).toHaveAttribute("aria-haspopup", "menu");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("opens with the keyboard and exposes the Profile, theme, and Sign out items", async () => {
    const user = userEvent.setup();
    renderMenu();
    const trigger = screen.getByRole("button", { name: /open user menu/i });
    trigger.focus();
    await user.keyboard("{Enter}");

    const menu = await screen.findByRole("menu");
    expect(trigger).toHaveAttribute("aria-expanded", "true");

    const items = within(menu).getAllByRole("menuitem");
    const labels = items.map((item) => item.textContent ?? "");
    expect(labels.some((label) => /profile/i.test(label))).toBe(true);
    expect(labels.some((label) => /theme/i.test(label))).toBe(true);
    expect(labels.some((label) => /sign out/i.test(label))).toBe(true);

    // Profile is a real link to the account page.
    const profile = within(menu).getByRole("menuitem", { name: /profile/i });
    expect(profile).toHaveAttribute("href", "/account");
  });

  it("is arrow-key navigable: focus moves to the first item on open", async () => {
    const user = userEvent.setup();
    renderMenu();
    const trigger = screen.getByRole("button", { name: /open user menu/i });
    trigger.focus();
    // ArrowDown opens the menu and moves focus to the first item.
    await user.keyboard("{ArrowDown}");
    const menu = await screen.findByRole("menu");
    const items = within(menu).getAllByRole("menuitem");
    expect(items[0]).toHaveFocus();
    // ArrowDown advances to the next item.
    await user.keyboard("{ArrowDown}");
    expect(items[1]).toHaveFocus();
  });

  it("closes on Escape and returns focus to the trigger", async () => {
    const user = userEvent.setup();
    renderMenu();
    const trigger = screen.getByRole("button", { name: /open user menu/i });
    trigger.focus();
    await user.keyboard("{Enter}");
    await screen.findByRole("menu");

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });
});
