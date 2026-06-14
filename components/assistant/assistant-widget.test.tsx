// @vitest-environment jsdom
import { createElement } from "react";

import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Controllable route params + a synchronous stub for the lazy panel.
const h = vi.hoisted(() => ({
  params: {} as Record<string, string>,
  stub: null as null | ((p: PanelProps) => unknown),
}));

type PanelProps = {
  campaignId: string;
  open: boolean;
  onClose: () => void;
  onReplyComplete: () => void;
};

vi.mock("next/navigation", () => ({ useParams: () => h.params }));
vi.mock("next/dynamic", () => ({
  default: () =>
    function StubPanel(props: PanelProps) {
      return h.stub ? h.stub(props) : null;
    },
}));

const { AssistantWidget } = await import("@/components/assistant/assistant-widget");

beforeEach(() => {
  h.params = { campaignId: "c1" };
  h.stub = (props) =>
    createElement(
      "div",
      {
        "data-testid": "panel",
        "data-open": String(props.open),
        "data-campaign": props.campaignId,
      },
      createElement("button", { onClick: props.onClose }, "stub-close"),
      createElement("button", { onClick: props.onReplyComplete }, "stub-reply"),
    );
});

const launcher = () => screen.getByRole("button", { name: /campaign assistant/i });

describe("AssistantWidget launcher semantics", () => {
  it("exposes aria-expanded, aria-controls, and the accessible name", () => {
    render(<AssistantWidget />);
    const btn = launcher();
    expect(btn).toHaveAttribute("aria-controls", "assistant-panel");
    expect(btn).toHaveAttribute("aria-expanded", "false");
    expect(btn).toHaveAccessibleName("Open campaign assistant");
  });

  it("lazy-mounts the panel only after first open and reflects expanded state", () => {
    render(<AssistantWidget />);
    expect(screen.queryByTestId("panel")).toBeNull();
    fireEvent.click(launcher());
    expect(screen.getByTestId("panel")).toHaveAttribute("data-open", "true");
    expect(launcher()).toHaveAttribute("aria-expanded", "true");
  });

  it("restores focus to the launcher when the panel closes", () => {
    render(<AssistantWidget />);
    fireEvent.click(launcher());
    fireEvent.click(screen.getByRole("button", { name: "stub-close" }));
    expect(launcher()).toHaveAttribute("aria-expanded", "false");
    expect(launcher()).toHaveFocus();
  });

  it("shows an unread indicator (in the accessible name) when a reply arrives while collapsed", () => {
    render(<AssistantWidget />);
    fireEvent.click(launcher()); // open
    fireEvent.click(screen.getByRole("button", { name: "stub-close" })); // collapse
    fireEvent.click(screen.getByRole("button", { name: "stub-reply" })); // reply while collapsed
    expect(launcher()).toHaveAccessibleName("Open campaign assistant, new reply");
  });
});

describe("AssistantWidget campaign scoping", () => {
  it("is disabled with a hint outside a campaign route", () => {
    h.params = {};
    render(<AssistantWidget />);
    const btn = screen.getByRole("button", { name: /open a campaign to use/i });
    expect(btn).toBeDisabled();
  });

  it("resets (collapses + drops the panel) when the active campaign changes", () => {
    const { rerender } = render(<AssistantWidget />);
    fireEvent.click(launcher());
    expect(screen.getByTestId("panel")).toBeInTheDocument();
    h.params = { campaignId: "c2" };
    rerender(<AssistantWidget />);
    expect(screen.queryByTestId("panel")).toBeNull();
    expect(launcher()).toHaveAttribute("aria-expanded", "false");
  });
});
