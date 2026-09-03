// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock the tRPC client: capture the commit mutation and provide a no-op utils object. `state`
// stands in for what the mutation has resolved with — an ActionEnvelope, for every outcome.
const { mutate, state } = vi.hoisted(() => ({
  mutate: vi.fn(),
  state: { data: undefined as unknown, isError: false },
}));
vi.mock("~/trpc/react", () => ({
  api: {
    useUtils: () => ({}),
    assistant: {
      commitProposal: {
        useMutation: () => ({
          mutate,
          isPending: false,
          data: state.data,
          isError: state.isError,
          error: null,
        }),
      },
    },
  },
}));

const { ProposalCard } = await import("@/components/assistant/proposal-card");

const createNpc = {
  action: "create",
  entity: "npc",
  campaignId: "c1",
  fields: { name: "Sera", role: "harbor guard", status: "alive" },
};

beforeEach(() => {
  vi.clearAllMocks();
  state.data = undefined;
  state.isError = false;
});

describe("ProposalCard", () => {
  it("renders a summary of the proposed change with Confirm and Cancel", () => {
    render(<ProposalCard raw={createNpc} />);
    expect(screen.getByText(/Create npc: Sera/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: /confirm/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /cancel/i })).toBeTruthy();
    expect(screen.getByText(/harbor guard/i)).toBeTruthy();
  });

  it("commits the proposal when Confirm is clicked", () => {
    render(<ProposalCard raw={createNpc} />);
    fireEvent.click(screen.getByRole("button", { name: /confirm/i }));
    expect(mutate).toHaveBeenCalledTimes(1);
    expect(mutate).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "create",
        entity: "npc",
        campaignId: "c1",
        fields: expect.objectContaining({ name: "Sera" }),
      }),
    );
  });

  it("writes nothing when Cancel is clicked", () => {
    render(<ProposalCard raw={createNpc} />);
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    expect(mutate).not.toHaveBeenCalled();
    expect(screen.getByText(/nothing was changed/i)).toBeTruthy();
  });

  it("shows the envelope's normalised message when the commit was refused", () => {
    // A refusal RESOLVES with an error envelope rather than rejecting.
    state.data = {
      outcome: "operation_error",
      code: "not_found",
      message: "That campaign or entity could not be found.",
    };
    render(<ProposalCard raw={createNpc} />);
    expect(screen.getByRole("alert")).toHaveTextContent("could not be found");
    // Still nothing was applied, so the card does not claim success.
    expect(screen.queryByText(/applied/i)).toBeNull();
  });

  it("falls back to a generic message when the mutation itself rejected", () => {
    state.isError = true;
    render(<ProposalCard raw={createNpc} />);
    expect(screen.getByRole("alert")).toHaveTextContent("could not be applied");
  });

  it("shows no error for a successful commit envelope", () => {
    state.data = {
      outcome: "success",
      action: "create",
      entity: "npc",
      entityId: "n1",
      title: "Sera",
    };
    render(<ProposalCard raw={createNpc} />);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("renders nothing for a malformed proposal part", () => {
    const { container } = render(<ProposalCard raw={{ action: "create", entity: "npc" }} />);
    expect(container.firstChild).toBeNull();
  });
});

describe("generated field labels", () => {
  it("marks only the fields the assistant chose itself", () => {
    render(<ProposalCard raw={createNpc} generated={["role"]} />);
    const role = screen.getByText(/harbor guard/).closest("dd");
    const name = screen.getByText("Sera").closest("dd");
    expect(role?.textContent).toContain("(generated)");
    expect(name?.textContent).not.toContain("(generated)");
  });

  it("marks nothing when the user supplied everything", () => {
    render(<ProposalCard raw={createNpc} />);
    expect(screen.queryByText("(generated)")).toBeNull();
  });
});
