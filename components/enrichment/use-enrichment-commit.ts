"use client";

import { useRouter } from "next/navigation";

import { api } from "~/trpc/react";

// Shared commit for enriched entities. Both surfaces (entity form + chat widget) use this so
// a confirmed proposal goes through the ONE commitProposal path and the campaign view updates
// everywhere: React Query lists are invalidated by consistent keys (shared query client), and
// `router.refresh()` re-runs the RSC list fetch on the campaign page — covering client-cached
// and server-rendered lists with no stale/duplicate/missing rows.
export function useEnrichmentCommit(campaignId: string) {
  const router = useRouter();
  const utils = api.useUtils();
  return api.assistant.commitProposal.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.npc.listByCampaign.invalidate({ campaignId }),
        utils.character.listByCampaign.invalidate({ campaignId }),
      ]);
      router.refresh();
    },
  });
}
