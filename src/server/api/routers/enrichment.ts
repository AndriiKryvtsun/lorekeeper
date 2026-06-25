import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { auditProposalEvent } from "@/lib/ai/audit";
import { enforceProposeRateLimit } from "@/lib/ai/rate-limit";
import { getProvider } from "@/lib/ai/tiers";
import { isOwnedCampaign } from "@/lib/data/owned";
import { lookupSrd } from "@/lib/sdk/server/srd";
import { createCharacterSchema } from "@/lib/validation/character";
import { createNpcSchema } from "@/lib/validation/npc";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";

// Entity-enrichment PROPOSE procedures. They never write — each returns the unified create
// proposal (the same envelope `commitProposal` accepts), to be confirmed by the human. Both
// verify campaign ownership and enforce a per-user rate limit BEFORE any SRD/LLM work.

const enrichKind = z.enum(["npc", "character"]);

// Gate: rate-limit first (cheap, protects the expensive work), then re-verify ownership.
async function gate(userId: string, campaignId: string): Promise<void> {
  const limited = await enforceProposeRateLimit(userId);
  if (!limited.ok) throw new TRPCError({ code: "TOO_MANY_REQUESTS" });
  if (!(await isOwnedCampaign(userId, campaignId))) {
    throw new TRPCError({ code: "NOT_FOUND" });
  }
}

// Field hints per entity for the JSON the model must produce. Validation against the real
// create-schema (with defaults/coercion) happens after generation.
const AGENT_FIELDS = {
  npc: 'name (string, required), role (string), description (string), status (string, e.g. "alive")',
  character:
    "name (string, required), playerName (string), class (string), level (integer), notes (string)",
} as const;

function agentSystem(kind: "npc" | "character"): string {
  return (
    `You generate a single original tabletop-RPG ${kind} as a JSON object with these keys: ` +
    `${AGENT_FIELDS[kind]}. Output ONLY the JSON object — no prose, no code fences, no commentary.`
  );
}

// Extract the first JSON object from a model's text response (tolerates code fences / preamble).
function extractJsonObject(text: string): unknown {
  const cleaned = text.replace(/```(?:json)?/gi, "");
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) return null;
  try {
    return JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    return null;
  }
}

export const enrichmentRouter = createTRPCRouter({
  // SRD lookup → zero/one/many candidates, each a ready-to-commit npc create proposal.
  proposeFromSrd: protectedProcedure
    .input(
      z.object({
        kind: enrichKind,
        campaignId: z.string().min(1),
        query: z.string().trim().min(1).max(120),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await gate(ctx.user.id, input.campaignId);
      // The open SRD covers monsters/creatures (NPCs), not player characters.
      if (input.kind !== "npc") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "SRD enrichment is available for NPCs only.",
        });
      }

      const candidates = await lookupSrd(input.query);
      auditProposalEvent({
        event: "proposal_generated",
        userId: ctx.user.id,
        campaignId: input.campaignId,
        action: "create",
        entity: "npc",
        source: "srd",
        outcome: "success",
      });

      return {
        candidates: candidates.map((c) => ({
          label: c.label,
          proposal: {
            action: "create" as const,
            entity: "npc" as const,
            campaignId: input.campaignId,
            fields: c.data,
            source: "srd" as const,
            attribution: c.attribution,
          },
        })),
      };
    }),

  // Agent generation → one create proposal for the requested kind, validated against the
  // SAME create schema the mutation uses (via generateObject).
  proposeFromAgent: protectedProcedure
    .input(
      z.object({
        kind: enrichKind,
        campaignId: z.string().min(1),
        prompt: z.string().trim().min(1).max(2000),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await gate(ctx.user.id, input.campaignId);

      // Provider-portable structured generation: ask for JSON via text, then validate against
      // the SAME create-schema the mutation uses (re-applies defaults, coerces, rejects bad output).
      const { text } = await getProvider("answer").generate({
        system: agentSystem(input.kind),
        messages: [{ role: "user", content: input.prompt }],
        temperature: 0.7,
        maxOutputTokens: 600,
      });
      const raw = extractJsonObject(text);

      const fields =
        input.kind === "npc"
          ? createNpcSchema.safeParse(raw)
          : createCharacterSchema.safeParse(raw);
      if (!fields.success) {
        auditProposalEvent({
          event: "proposal_generated",
          userId: ctx.user.id,
          campaignId: input.campaignId,
          action: "create",
          entity: input.kind,
          source: "agent",
          outcome: "error",
          reason: "invalid_generation",
        });
        throw new TRPCError({
          code: "UNPROCESSABLE_CONTENT",
          message: "Could not generate a valid entity. Try rephrasing.",
        });
      }

      auditProposalEvent({
        event: "proposal_generated",
        userId: ctx.user.id,
        campaignId: input.campaignId,
        action: "create",
        entity: input.kind,
        source: "agent",
        outcome: "success",
      });

      return {
        proposal: {
          action: "create" as const,
          entity: input.kind,
          campaignId: input.campaignId,
          fields: fields.data,
          source: "agent" as const,
        },
      };
    }),
});
