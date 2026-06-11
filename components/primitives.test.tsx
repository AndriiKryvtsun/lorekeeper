// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

describe("Button renders accessible markup", () => {
  it("is a real button with an accessible name", () => {
    render(<Button>Save</Button>);
    const button = screen.getByRole("button", { name: "Save" });
    expect(button).toBeInTheDocument();
    // Native <button> is keyboard-operable by default (focusable + Enter/Space).
    expect(button.tagName).toBe("BUTTON");
  });

  it("supports asChild to render as another element with a role", () => {
    render(
      <Button asChild>
        <a href="/somewhere">Go</a>
      </Button>,
    );
    expect(screen.getByRole("link", { name: "Go" })).toHaveAttribute(
      "href",
      "/somewhere",
    );
  });
});

describe("Labelled form control links its error", () => {
  it("associates label and references error text via aria-describedby + aria-invalid", () => {
    render(
      <div>
        <Label htmlFor="title">Title</Label>
        <Input
          id="title"
          aria-invalid={true}
          aria-describedby="title-error"
        />
        <p id="title-error">Title is required</p>
      </div>,
    );

    const input = screen.getByLabelText("Title");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAttribute("aria-describedby", "title-error");
    expect(screen.getByText("Title is required")).toHaveAttribute(
      "id",
      "title-error",
    );
  });
});

describe("Dialog exposes role and accessible name", () => {
  it("renders a dialog with a name from its title", () => {
    render(
      <Dialog open>
        <DialogContent>
          <DialogTitle>Delete campaign</DialogTitle>
          <DialogDescription>This cannot be undone.</DialogDescription>
        </DialogContent>
      </Dialog>,
    );

    const dialog = screen.getByRole("dialog", { name: "Delete campaign" });
    expect(dialog).toBeInTheDocument();
  });
});
