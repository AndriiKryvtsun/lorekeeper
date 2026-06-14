// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

type Msg = { id: string; role: "user" | "assistant"; parts: { type: string; text?: string }[] };

// Controllable useChat mock.
const chat = vi.hoisted(() => ({
  messages: [] as Msg[],
  status: "ready" as "submitted" | "streaming" | "ready" | "error",
  sendMessage: vi.fn(),
  error: null as unknown,
  clearError: vi.fn(),
}));
vi.mock("@ai-sdk/react", () => ({
  useChat: () => ({
    messages: chat.messages,
    status: chat.status,
    sendMessage: chat.sendMessage,
    error: chat.error,
    clearError: chat.clearError,
  }),
}));

const AssistantPanel = (await import("@/components/assistant/assistant-panel")).default;
const noop = () => {};

beforeEach(() => {
  chat.messages = [];
  chat.status = "ready";
  chat.error = null;
  chat.sendMessage = vi.fn();
});

describe("AssistantPanel accessibility", () => {
  it("moves focus to the message input when opened", () => {
    render(
      <AssistantPanel campaignId="c1" open onClose={noop} onReplyComplete={noop} />,
    );
    expect(document.getElementById("assistant-input")).toHaveFocus();
  });

  it("closes on Escape (no focus trap — handler delegates to onClose)", () => {
    const onClose = vi.fn();
    render(
      <AssistantPanel campaignId="c1" open onClose={onClose} onReplyComplete={noop} />,
    );
    fireEvent.keyDown(screen.getByRole("region", { name: "Campaign assistant" }), {
      key: "Escape",
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("announces a reply via the live region only when streaming completes", () => {
    chat.messages = [
      { id: "a1", role: "assistant", parts: [{ type: "text", text: "Sera is the harbor guard." }] },
    ];
    chat.status = "streaming";
    const onReplyComplete = vi.fn();
    const { rerender, container } = render(
      <AssistantPanel
        campaignId="c1"
        open
        onClose={noop}
        onReplyComplete={onReplyComplete}
      />,
    );
    const live = container.querySelector('[aria-live="polite"][role="log"]');
    // Mid-stream: nothing announced yet.
    expect(live?.textContent).toBe("");
    // Completion: status settles → announced once.
    chat.status = "ready";
    rerender(
      <AssistantPanel
        campaignId="c1"
        open
        onClose={noop}
        onReplyComplete={onReplyComplete}
      />,
    );
    expect(live?.textContent).toContain("Sera is the harbor guard.");
    expect(onReplyComplete).toHaveBeenCalledTimes(1);
  });
});

describe("AssistantPanel request", () => {
  it("sends the message to the assistant scoped to the campaignId (server pipeline unchanged)", () => {
    render(
      <AssistantPanel campaignId="c1" open onClose={noop} onReplyComplete={noop} />,
    );
    fireEvent.change(document.getElementById("assistant-input")!, {
      target: { value: "Who is the innkeeper?" },
    });
    fireEvent.submit(screen.getByRole("region", { name: "Campaign assistant" }).querySelector("form")!);
    expect(chat.sendMessage).toHaveBeenCalledWith(
      { text: "Who is the innkeeper?" },
      { body: { campaignId: "c1" } },
    );
  });
});
