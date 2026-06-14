import { TRPCError } from "@trpc/server";

import { auditProposalEvent } from "@/lib/ai/audit";
import { commitProposal } from "@/lib/data/proposal";
import {
  parseProposal,
  proposalEnvelopeSchema,
} from "@/lib/validation/assistant-proposal";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";

// The confirm-before-write commit. The model is NOT in this path — only an already-validated
// proposal reaches here, the write goes through the existing owner-scoped data layer, and the
// confirming user is re-authenticated (protectedProcedure) and re-checked for ownership.
export const assistantRouter = createTRPCRouter({
  commitProposal: protectedProcedure
    .input(proposalEnvelopeSchema)
    .mutation(async ({ ctx, input }) => {
      // Re-validate the proposal (envelope + per-entity fields) before any write.
      const proposal = parseProposal(input);
      if (!proposal) {
        auditProposalEvent({
          event: "proposal_committed",
          userId: ctx.user.id,
          campaignId: input.campaignId,
          action: input.action,
          entity: input.entity,
          outcome: "error",
          reason: "invalid_proposal",
        });
        throw new TRPCError({ code: "BAD_REQUEST" });
      }

      const result = await commitProposal(ctx.user.id, proposal);
      auditProposalEvent({
        event: "proposal_committed",
        userId: ctx.user.id,
        campaignId: proposal.campaignId,
        action: proposal.action,
        entity: proposal.entity,
        outcome: result.ok ? "success" : "error",
        entityId: result.ok ? result.id : undefined,
        reason: result.ok ? undefined : result.reason,
      });

      if (!result.ok) {
        throw new TRPCError({
          code: result.reason === "invalid" ? "BAD_REQUEST" : "NOT_FOUND",
        });
      }
      return { id: result.id, action: proposal.action, entity: proposal.entity };
    }),
});
