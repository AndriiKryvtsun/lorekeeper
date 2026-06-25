// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Capture the mutation options passed to commitProposal so we can invoke onSuccess and assert
// the cross-surface revalidation (consistent query-key invalidation + RSC route refresh).
const invalidateNpc = vi.fn();
const invalidateCharacter = vi.fn();
const refresh = vi.fn();
let capturedOptions: { onSuccess?: () => Promise<void> | void } = {};

vi.mock("~/trpc/react", () => ({
  api: {
    useUtils: () => ({
      npc: { listByCampaign: { invalidate: invalidateNpc } },
      character: { listByCampaign: { invalidate: invalidateCharacter } },
    }),
    assistant: {
      commitProposal: {
        useMutation: (options: typeof capturedOptions) => {
          capturedOptions = options;
          return { mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false };
        },
      },
    },
  },
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

const { useEnrichmentCommit } = await import(
  "@/components/enrichment/use-enrichment-commit"
);

beforeEach(() => {
  vi.clearAllMocks();
  capturedOptions = {};
});

describe("useEnrichmentCommit", () => {
  it("invalidates both entity lists by consistent keys and refreshes the route on success", async () => {
    renderHook(() => useEnrichmentCommit("c1"));
    expect(capturedOptions.onSuccess).toBeTypeOf("function");

    await capturedOptions.onSuccess!();

    expect(invalidateNpc).toHaveBeenCalledWith({ campaignId: "c1" });
    expect(invalidateCharacter).toHaveBeenCalledWith({ campaignId: "c1" });
    expect(refresh).toHaveBeenCalledTimes(1);
  });
});
