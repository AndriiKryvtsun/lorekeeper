// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { EnrichMatchPicker } from "@/components/enrichment/match-picker";

describe("EnrichMatchPicker", () => {
  it("renders an accessible group of choice buttons", () => {
    render(
      <EnrichMatchPicker
        matches={["Goblin", "Goblin Boss"]}
        onPick={() => {}}
        onCancel={() => {}}
      />,
    );
    const group = screen.getByRole("group", { name: /choose a match/i });
    // two choices + a cancel button
    expect(within(group).getAllByRole("button")).toHaveLength(3);
  });

  it("is keyboard-operable: Enter on a choice picks its index", async () => {
    const user = userEvent.setup();
    const onPick = vi.fn();
    render(
      <EnrichMatchPicker
        matches={["Goblin", "Goblin Boss"]}
        onPick={onPick}
        onCancel={() => {}}
      />,
    );
    screen.getByRole("button", { name: "Goblin Boss" }).focus();
    await user.keyboard("{Enter}");
    expect(onPick).toHaveBeenCalledWith(1);
  });

  it("cancels via the cancel button", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(
      <EnrichMatchPicker matches={["Goblin"]} onPick={() => {}} onCancel={onCancel} />,
    );
    await user.click(screen.getByRole("button", { name: /cancel/i }));
    expect(onCancel).toHaveBeenCalled();
  });
});
