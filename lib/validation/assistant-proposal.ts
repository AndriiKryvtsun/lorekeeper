import { z } from "zod";

import {
  createCharacterSchema,
  updateCharacterSchema,
  type CreateCharacterInput,
  type UpdateCharacterInput,
} from "@/lib/validation/character";
import {
  createItemSchema,
  updateItemSchema,
  type CreateItemInput,
  type UpdateItemInput,
} from "@/lib/validation/item";
import {
  createLocationSchema,
  updateLocationSchema,
  type CreateLocationInput,
  type UpdateLocationInput,
} from "@/lib/validation/location";
import {
  createNpcSchema,
  updateNpcSchema,
  type CreateNpcInput,
  type UpdateNpcInput,
} from "@/lib/validation/npc";
import {
  createSessionSchema,
  updateSessionSchema,
  type CreateSessionInput,
  type UpdateSessionInput,
} from "@/lib/validation/session";

// A campaign-assistant write PROPOSAL. The model only ever produces a proposal of this shape;
// the actual write is performed elsewhere, after explicit human confirmation, through the
// existing owner-scoped data layer. The per-entity `fields` REUSE the existing create/update
// input schemas so a proposal that validates here is, by construction, committable.

export const PROPOSAL_ENTITIES = [
  "npc",
  "location",
  "item",
  "session",
  "character",
] as const;
export type ProposalEntity = (typeof PROPOSAL_ENTITIES)[number];

export const PROPOSAL_ACTIONS = ["create", "update", "delete"] as const;
export type ProposalAction = (typeof PROPOSAL_ACTIONS)[number];

// A create proposal MAY be tagged with the source it came from (entity enrichment). Both
// sources produce the SAME validated fields and commit through the one path; `attribution`
// carries the OGL/CC notice for SRD-sourced entities so it can be persisted.
export const PROPOSAL_SOURCES = ["srd", "agent"] as const;
export type ProposalSource = (typeof PROPOSAL_SOURCES)[number];

// The creatable/updatable fields per entity — the SAME schemas the tRPC mutations validate.
export const createFieldSchemas = {
  npc: createNpcSchema,
  location: createLocationSchema,
  item: createItemSchema,
  session: createSessionSchema,
  character: createCharacterSchema,
} as const;

export const updateFieldSchemas = {
  npc: updateNpcSchema,
  location: updateLocationSchema,
  item: updateItemSchema,
  session: updateSessionSchema,
  character: updateCharacterSchema,
} as const;

type CreateInputByEntity = {
  npc: CreateNpcInput;
  location: CreateLocationInput;
  item: CreateItemInput;
  session: CreateSessionInput;
  character: CreateCharacterInput;
};
type UpdateInputByEntity = {
  npc: UpdateNpcInput;
  location: UpdateLocationInput;
  item: UpdateItemInput;
  session: UpdateSessionInput;
  character: UpdateCharacterInput;
};

// `create` carries fields; `update`/`delete` carry a `target` (the existing entity's name,
// resolved to an id server-side — the model never supplies an id). `update` also carries the
// partial fields to change.
export type CreateProposal = {
  [E in ProposalEntity]: {
    action: "create";
    entity: E;
    campaignId: string;
    fields: CreateInputByEntity[E];
    // Optional enrichment provenance (entity-enrichment). Absent for plain assistant creates.
    source?: ProposalSource;
    attribution?: string;
  };
}[ProposalEntity];

export type UpdateProposal = {
  [E in ProposalEntity]: {
    action: "update";
    entity: E;
    campaignId: string;
    target: string;
    fields: UpdateInputByEntity[E];
  };
}[ProposalEntity];

export type DeleteProposal = {
  action: "delete";
  entity: ProposalEntity;
  campaignId: string;
  target: string;
};

export type Proposal = CreateProposal | UpdateProposal | DeleteProposal;

// Envelope shape (used as the tRPC commit input). `fields` is validated per-entity in
// parseProposal, never trusted as-is.
export const proposalEnvelopeSchema = z.object({
  action: z.enum(PROPOSAL_ACTIONS),
  entity: z.enum(PROPOSAL_ENTITIES),
  campaignId: z.string().trim().min(1),
  target: z.string().trim().min(1).optional(),
  fields: z.unknown().optional(),
  // Enrichment provenance (create only). Validated/threaded in parseProposal.
  source: z.enum(PROPOSAL_SOURCES).optional(),
  attribution: z.string().trim().min(1).optional(),
});

// Validate an untrusted/model-produced object into a typed Proposal, or null if it is not a
// well-formed, committable proposal. This is the single validation boundary for proposals:
// it re-validates `fields` against the entity's own create/update schema and requires a
// `target` for update/delete. Unknown/over-scoped field keys are stripped by the field schema.
export function parseProposal(raw: unknown): Proposal | null {
  const env = proposalEnvelopeSchema.safeParse(raw);
  if (!env.success) return null;
  const { action, entity, campaignId, target, fields, source, attribution } = env.data;

  if (action === "create") {
    const parsed = createFieldSchemas[entity].safeParse(fields);
    if (!parsed.success) return null;
    // Attribution is only meaningful for an SRD source; drop it otherwise.
    return {
      action,
      entity,
      campaignId,
      fields: parsed.data,
      source,
      attribution: source === "srd" ? attribution : undefined,
    } as Proposal;
  }

  if (action === "update") {
    if (!target) return null;
    const parsed = updateFieldSchemas[entity].safeParse(fields);
    if (!parsed.success) return null;
    return { action, entity, campaignId, target, fields: parsed.data } as Proposal;
  }

  // delete
  if (!target) return null;
  return { action, entity, campaignId, target };
}

// The display name field differs by entity (sessions use `title`).
export function proposalTitle(proposal: Proposal): string {
  if (proposal.action === "create") {
    const f = proposal.fields as { name?: string; title?: string };
    return f.name ?? f.title ?? "(unnamed)";
  }
  return proposal.target;
}
