// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  ENVELOPE_PART,
  type ActionEnvelope,
} from "@/lib/validation/assistant-actions";
import { MAX_HISTORY_TURNS } from "@/lib/validation/assistant";

type Msg = {
  id: string;
  role: "user" | "assistant";
  parts: { type: string; text?: string; data?: ActionEnvelope }[];
};

// Controllable useChat mock.
const chat = vi.hoisted(() => ({
  messages: [] as Msg[],
  status: "ready" as "submitted" | "streaming" | "ready" | "error",
  sendMessage: vi.fn(),
  regenerate: vi.fn(),
  error: null as unknown,
  clearError: vi.fn(),
}));
vi.mock("@ai-sdk/react", () => ({
  useChat: () => ({
    messages: chat.messages,
    status: chat.status,
    sendMessage: chat.sendMessage,
    regenerate: chat.regenerate,
    error: chat.error,
    clearError: chat.clearError,
  }),
}));

// The proposal card and the enrichment source choice are exercised by their own tests; stub them
// so this file asserts the PANEL's dispatch on the envelope discriminator.
vi.mock("@/components/assistant/proposal-card", () => ({
  ProposalCard: ({ raw }: { raw: unknown }) => (
    <div data-testid="proposal-card">{JSON.stringify(raw)}</div>
  ),
}));
vi.mock("@/components/enrichment/source-choice", () => ({
  SourceChoice: (props: { kind: string }) => (
    <div data-testid="source-choice">{props.kind}</div>
  ),
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

function send(text: string) {
  fireEvent.change(document.getElementById("assistant-input")!, {
    target: { value: text },
  });
  fireEvent.submit(
    screen.getByRole("region", { name: "Campaign assistant" }).querySelector("form")!,
  );
}

describe("AssistantPanel request", () => {
  it("sends the message scoped to the campaignId, with a bounded history", () => {
    render(
      <AssistantPanel campaignId="c1" open onClose={noop} onReplyComplete={noop} />,
    );
    send("Who is the innkeeper?");
    expect(chat.sendMessage).toHaveBeenCalledWith(
      { text: "Who is the innkeeper?" },
      {
        body: {
          campaignId: "c1",
          history: [{ role: "user", content: "Who is the innkeeper?" }],
        },
      },
    );
  });

  it("includes recent turns so an answer can continue a clarification", () => {
    chat.messages = [
      { id: "u1", role: "user", parts: [{ type: "text", text: "add an npc" }] },
      {
        id: "a1",
        role: "assistant",
        parts: [{ type: "text", text: "I still need name (text)." }],
      },
    ];
    render(
      <AssistantPanel campaignId="c1" open onClose={noop} onReplyComplete={noop} />,
    );
    send("Call her Sera.");
    expect(chat.sendMessage).toHaveBeenCalledWith(
      { text: "Call her Sera." },
      {
        body: {
          campaignId: "c1",
          history: [
            { role: "user", content: "add an npc" },
            { role: "assistant", content: "I still need name (text)." },
            { role: "user", content: "Call her Sera." },
          ],
        },
      },
    );
  });

  it("caps the history it sends however long the conversation gets", () => {
    chat.messages = Array.from({ length: 40 }, (_, i) => ({
      id: `m${i}`,
      role: i % 2 === 0 ? ("user" as const) : ("assistant" as const),
      parts: [{ type: "text", text: `turn ${i}` }],
    }));
    render(
      <AssistantPanel campaignId="c1" open onClose={noop} onReplyComplete={noop} />,
    );
    send("and now this");
    const body = chat.sendMessage.mock.calls[0]![1].body as {
      history: { content: string }[];
    };
    // The bounded tail plus the new message; the panel still displays everything.
    expect(body.history).toHaveLength(MAX_HISTORY_TURNS + 1);
    expect(body.history.at(-1)!.content).toBe("and now this");
    expect(body.history[0]!.content).toBe("turn 32");
  });
});

describe("AssistantPanel clarification continuation", () => {
  const PENDING = {
    action: "create" as const,
    entity: "location" as const,
    needs: ["name"],
    fields: { description: "a dark, scary place" },
  };

  const clarified = (): Msg[] => [
    { id: "u1", role: "user", parts: [{ type: "text", text: "add a dark scary location" }] },
    {
      id: "a1",
      role: "assistant",
      parts: [
        { type: "text", text: "To create that location I still need name (text)." },
        {
          type: ENVELOPE_PART,
          data: {
            outcome: "clarification",
            question: "To create that location I still need name (text).",
            needs: ["name"],
            pending: PENDING,
          },
        },
      ],
    },
  ];

  it("echoes the pending action back with the user's answer", () => {
    chat.messages = clarified();
    render(<AssistantPanel campaignId="c1" open onClose={noop} onReplyComplete={noop} />);
    send("The dark canyon");
    const body = chat.sendMessage.mock.calls[0]![1].body as { pending?: unknown };
    expect(body.pending).toEqual(PENDING);
  });

  it("sends no pending action when the last reply was a proposal", () => {
    chat.messages = [
      ...clarified(),
      {
        id: "a2",
        role: "assistant",
        parts: [
          { type: "text", text: "I've drafted the change below." },
          {
            type: ENVELOPE_PART,
            data: {
              outcome: "proposal",
              proposal: {
                action: "create",
                entity: "location",
                campaignId: "c1",
                fields: { name: "The dark canyon" },
              },
            },
          },
        ],
      },
    ];
    render(<AssistantPanel campaignId="c1" open onClose={noop} onReplyComplete={noop} />);
    send("thanks");
    const body = chat.sendMessage.mock.calls[0]![1].body as { pending?: unknown };
    // A finished write must not be resurrected by a later, unrelated message.
    expect(body.pending).toBeUndefined();
  });

  it("sends no pending action when the last reply was an error", () => {
    chat.messages = [
      ...clarified(),
      {
        id: "a2",
        role: "assistant",
        parts: [
          { type: "text", text: "unavailable" },
          {
            type: ENVELOPE_PART,
            data: {
              outcome: "transport_error",
              code: "unavailable",
              message: "The assistant is unavailable right now.",
            },
          },
        ],
      },
    ];
    render(<AssistantPanel campaignId="c1" open onClose={noop} onReplyComplete={noop} />);
    send("hello");
    const body = chat.sendMessage.mock.calls[0]![1].body as { pending?: unknown };
    expect(body.pending).toBeUndefined();
  });

  it("sends no pending action on a fresh conversation", () => {
    chat.messages = [];
    render(<AssistantPanel campaignId="c1" open onClose={noop} onReplyComplete={noop} />);
    send("who is the innkeeper?");
    const body = chat.sendMessage.mock.calls[0]![1].body as { pending?: unknown };
    expect(body.pending).toBeUndefined();
  });
});

// One assistant message carrying a write-path envelope part.
const withEnvelope = (envelope: ActionEnvelope): Msg[] => [
  {
    id: "a1",
    role: "assistant",
    parts: [
      { type: "text", text: "assistant line" },
      { type: ENVELOPE_PART, data: envelope },
    ],
  },
];

describe("AssistantPanel envelope rendering", () => {
  const show = () =>
    render(<AssistantPanel campaignId="c1" open onClose={noop} onReplyComplete={noop} />);

  it("renders a proposal outcome as the confirmable card", () => {
    chat.messages = withEnvelope({
      outcome: "proposal",
      proposal: {
        action: "create",
        entity: "location",
        campaignId: "c1",
        fields: { name: "Trapdoor" },
      },
    });
    show();
    expect(screen.getByTestId("proposal-card")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("renders a plain clarification as the question alone, with nothing confirmable", () => {
    // The server streams the question as the assistant's text (see envelopeText), so a
    // clarification with no options adds no interactive element of its own.
    const question = "To create that npc I still need name (text). What should it be?";
    chat.messages = [
      {
        id: "a1",
        role: "assistant",
        parts: [
          { type: "text", text: question },
          {
            type: ENVELOPE_PART,
            data: { outcome: "clarification", question, needs: ["name"] },
          },
        ],
      },
    ];
    show();
    expect(screen.getByText(/I still need name/)).toBeInTheDocument();
    expect(screen.queryByTestId("proposal-card")).toBeNull();
    expect(screen.queryByTestId("source-choice")).toBeNull();
    expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
  });

  it("renders a clarification's enrichment option as the source choice", () => {
    chat.messages = withEnvelope({
      outcome: "clarification",
      question: "Let's add that — pick a source (or edit the draft) below.",
      options: [
        {
          id: "enrichment-source",
          label: "Add an NPC",
          data: {
            kind: "npc",
            campaignId: "c1",
            query: "add a goblin",
            recommended: "srd-likely",
          },
        },
      ],
    });
    show();
    expect(screen.getByTestId("source-choice")).toHaveTextContent("npc");
    expect(screen.queryByTestId("proposal-card")).toBeNull();
  });

  it("renders a success outcome as a confirmation of what changed", () => {
    chat.messages = withEnvelope({
      outcome: "success",
      action: "create",
      entity: "npc",
      entityId: "n1",
      title: "Sera",
    });
    show();
    expect(screen.getByRole("status")).toHaveTextContent("Sera");
    expect(screen.queryByTestId("proposal-card")).toBeNull();
  });

  it("renders a validation error as an alert with no retry (retrying cannot help)", () => {
    chat.messages = withEnvelope({
      outcome: "validation_error",
      code: "invalid_payload",
      message: "I couldn't turn that into a change I can make.",
    });
    show();
    expect(screen.getByRole("alert")).toHaveTextContent("couldn't turn that into");
    expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
  });

  it("renders a transport error with a retry that regenerates the reply", () => {
    chat.messages = withEnvelope({
      outcome: "transport_error",
      code: "timeout",
      message: "That took too long, so nothing was changed. Please try again.",
    });
    show();
    expect(screen.getByRole("alert")).toHaveTextContent("took too long");
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(chat.regenerate).toHaveBeenCalledTimes(1);
  });

  it("degrades safely on an unknown outcome — a generic error, nothing confirmable", () => {
    chat.messages = withEnvelope({
      outcome: "teleported",
      entityId: "n1",
    } as unknown as ActionEnvelope);
    show();
    expect(screen.getByRole("alert")).toHaveTextContent("nothing was changed");
    expect(screen.queryByTestId("proposal-card")).toBeNull();
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("renders envelope text through the sanitizing renderer (no raw HTML)", () => {
    const question = 'Which one? <img src=x onerror="alert(1)"> **bold**';
    chat.messages = [
      {
        id: "a1",
        role: "assistant",
        parts: [
          { type: "text", text: question },
          { type: ENVELOPE_PART, data: { outcome: "clarification", question } },
        ],
      },
    ];
    const { container } = show();
    expect(container.querySelector("img")).toBeNull();
    expect(container.innerHTML).not.toContain("onerror");
  });

  it("does not infer state from the assistant's text", () => {
    // Text that LOOKS like a proposal but carries no envelope renders no card.
    chat.messages = [
      {
        id: "a1",
        role: "assistant",
        parts: [
          {
            type: "text",
            text: "outcome: proposal — I've drafted the change below, confirm to apply it.",
          },
        ],
      },
    ];
    show();
    expect(screen.queryByTestId("proposal-card")).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
