// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// Mock the tRPC client so the component renders without a provider/network.
vi.mock("~/trpc/react", () => ({
  api: {
    useUtils: () => ({
      npc: { listByCampaign: { invalidate: vi.fn() } },
      character: { listByCampaign: { invalidate: vi.fn() } },
    }),
    assistant: {
      commitProposal: {
        useMutation: () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false }),
      },
    },
    enrichment: {
      proposeFromSrd: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
      proposeFromAgent: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
    },
  },
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

const { SourceChoice } = await import("@/components/enrichment/source-choice");

describe("SourceChoice", () => {
  it("shows two source buttons when the intent is ambiguous (NPC)", () => {
    render(
      <SourceChoice kind="npc" campaignId="c1" query="goblin" recommended="ambiguous" />,
    );
    expect(screen.getByRole("button", { name: /from srd/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /generate/i })).toBeInTheDocument();
  });

  it("offers only Generate for characters (SRD is NPC-only)", () => {
    render(
      <SourceChoice
        kind="character"
        campaignId="c1"
        query="a bard"
        recommended="ambiguous"
      />,
    );
    expect(screen.queryByRole("button", { name: /from srd/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /generate/i })).toBeInTheDocument();
  });
});
