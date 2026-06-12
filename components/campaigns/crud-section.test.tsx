// @vitest-environment jsdom
import { zodResolver } from "@hookform/resolvers/zod";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CrudSection } from "@/components/campaigns/crud-section";
import { createCharacterSchema } from "@/lib/validation/character";

// CrudSection uses next/navigation's useRouter; stub it.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), back: vi.fn() }),
}));

type Row = { id: string };

function renderSection(overrides?: {
  initialItems?: Row[];
  rowTitle?: (r: Row) => string;
  createFn?: ReturnType<typeof vi.fn>;
}) {
  const createFn = overrides?.createFn ?? vi.fn();
  render(
    <CrudSection<Row, typeof createCharacterSchema._input>
      title="Characters"
      itemLabel="character"
      initialItems={overrides?.initialItems ?? []}
      resolver={zodResolver(createCharacterSchema)}
      fields={[
        { name: "name", label: "Name" },
        { name: "playerName", label: "Player" },
        { name: "class", label: "Class" },
        { name: "level", label: "Level", control: "number" },
      ]}
      emptyDefaults={{ name: "", playerName: "", class: "", level: 1 }}
      toDefaults={(r) => ({ name: "", playerName: "", class: "", level: 1, ...r })}
      rowTitle={overrides?.rowTitle ?? ((r) => r.id)}
      createFn={createFn}
      updateFn={vi.fn()}
      deleteFn={vi.fn()}
    />,
  );
  return { createFn };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("form rejects invalid input with inline errors", () => {
  it("blocks submit and shows a field error when required fields are empty", async () => {
    const user = userEvent.setup();
    const { createFn } = renderSection();

    // Only the trigger exists before opening; click it to open the dialog.
    await user.click(screen.getByRole("button", { name: /add character/i }));
    const dialog = await screen.findByRole("dialog");

    // Submit the empty form via the dialog's submit button.
    await user.click(within(dialog).getByRole("button", { name: /add character/i }));

    // Empty required fields surface an inline validation error and block submission.
    expect((await within(dialog).findAllByText(/required/i)).length).toBeGreaterThan(0);
    expect(createFn).not.toHaveBeenCalled();
  });
});

describe("user content renders as plain text", () => {
  it("does not interpret script-like content as markup", () => {
    const payload = "<script>alert('xss')</script>";
    renderSection({ initialItems: [{ id: "1" }], rowTitle: () => payload });

    expect(screen.getByText(payload)).toBeInTheDocument();
    expect(document.querySelector("script")).toBeNull();
  });
});
