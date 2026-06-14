// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock the tRPC client: capture the commit mutation and provide a no-op utils object.
const { mutate } = vi.hoisted(() => ({ mutate: vi.fn() }));
vi.mock("~/trpc/react", () => ({
  api: {
    useUtils: () => ({}),
    assistant: {
      commitProposal: {
        useMutation: () => ({ mutate, isPending: false, isError: false, error: null }),
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

beforeEach(() => vi.clearAllMocks());

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

  it("renders nothing for a malformed proposal part", () => {
    const { container } = render(<ProposalCard raw={{ action: "create", entity: "npc" }} />);
    expect(container.firstChild).toBeNull();
  });
});
