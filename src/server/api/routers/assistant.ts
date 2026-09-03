import {
  invalidPayloadEnvelope,
  normalizeFailure,
  operationErrorEnvelope,
  successEnvelope,
  unsupportedActionEnvelope,
} from "@/lib/ai/action-envelope";
import { auditProposalEvent } from "@/lib/ai/audit";
import { commitProposal } from "@/lib/data/proposal";
import { validatePayload } from "@/lib/validation/action-validator";
import {
  resolveActionKey,
  type ActionEnvelope,
} from "@/lib/validation/assistant-actions";
import {
  parseProposal,
  proposalEnvelopeSchema,
  proposalTitle,
} from "@/lib/validation/assistant-proposal";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";

// The confirm-before-write commit. The model is NOT in this path. The action registry decides
// which operation may run and under which scope; the payload is re-validated against that same
// entry's schema; the write goes through the existing owner-scoped data layer; and the confirming
// user is re-authenticated (protectedProcedure) and re-checked for ownership.
//
// EVERY outcome is returned as an ActionEnvelope, so the chat UI branches on one discriminator
// instead of on error codes and message text. Nothing here reveals whether a resource it refused
// actually exists.
export const assistantRouter = createTRPCRouter({
  commitProposal: protectedProcedure
    .input(proposalEnvelopeSchema)
    .mutation(async ({ ctx, input }): Promise<ActionEnvelope> => {
      const audit = (
        outcome: "success" | "error",
        extra: { scope?: string; entityId?: string; reason?: string } = {},
      ) =>
        auditProposalEvent({
          event: "proposal_committed",
          userId: ctx.user.id,
          campaignId: input.campaignId,
          action: input.action,
          entity: input.entity,
          source: input.source,
          outcome,
          ...extra,
        });

      // An (action, entity) pair with no registry entry is not executable. There is no fallback.
      const resolution = resolveActionKey(input.action, input.entity);
      if (!resolution.ok) {
        audit("error", { reason: "unsupported_action" });
        return unsupportedActionEnvelope();
      }
      const entry = resolution.entry;

      // Re-validate against the SAME entry schema, so a payload altered between proposal and
      // confirmation cannot be written. `parseProposal` then yields the typed, committable value.
      const validated = validatePayload(entry, input.fields);
      const proposal = validated.ok ? parseProposal(input) : null;
      if (!proposal) {
        audit("error", { scope: entry.scope, reason: "invalid_payload" });
        return invalidPayloadEnvelope();
      }

      try {
        const result = await commitProposal(ctx.user.id, proposal);
        if (!result.ok) {
          audit("error", { scope: entry.scope, reason: result.reason });
          // An unowned campaign and a missing one are the same not-found outcome.
          return operationErrorEnvelope(result.reason);
        }
        audit("success", { scope: entry.scope, entityId: result.id });
        return successEnvelope(
          proposal.action,
          proposal.entity,
          result.id,
          proposalTitle(proposal),
        );
      } catch (error) {
        // Nothing unrecognised escapes: it is normalised and logged redacted.
        audit("error", { scope: entry.scope, reason: "transport" });
        return normalizeFailure(error, "commit_proposal");
      }
    }),
});
