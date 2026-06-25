import "server-only";

import {
  createNpcForOwnedCampaign,
  deleteNpcForOwner,
  listNpcsForOwnedCampaign,
  updateNpcForOwner,
} from "@/lib/data/campaigns";
import {
  createCharacterForOwner,
  deleteCharacterForOwner,
  listCharactersForOwner,
  updateCharacterForOwner,
} from "@/lib/data/characters";
import {
  createItemForOwner,
  deleteItemForOwner,
  listItemsForOwner,
  OwnerNpcNotInCampaignError,
  updateItemForOwner,
} from "@/lib/data/items";
import {
  createLocationForOwner,
  deleteLocationForOwner,
  listLocationsForOwner,
  updateLocationForOwner,
} from "@/lib/data/locations";
import {
  createSessionForOwner,
  deleteSessionForOwner,
  listSessionsForOwner,
  updateSessionForOwner,
} from "@/lib/data/sessions";
import type { Proposal, ProposalEntity } from "@/lib/validation/assistant-proposal";

// Commit a confirmed proposal through the EXISTING owner-scoped data layer. The model is not
// in this path — only typed, already-validated data reaches here. Ownership is re-checked by
// each data-layer function (a wrong owner/missing parent yields null → reported as not_found).

export type CommitResult =
  | { ok: true; id: string }
  | { ok: false; reason: "not_found" | "invalid" };

// Resolve an entity's existing name to its id WITHIN an owned campaign. Returns null when the
// campaign is not owned, or when the name matches zero or more than one row (ambiguous) — the
// caller must not write in those cases. Matching is case-insensitive on the display name.
export async function resolveEntityIdByName(
  ownerId: string,
  campaignId: string,
  entity: ProposalEntity,
  name: string,
): Promise<string | null> {
  const wanted = name.trim().toLowerCase();
  const rows = await listNamed(ownerId, campaignId, entity);
  if (rows === null) return null;
  const matches = rows.filter((r) => r.name.trim().toLowerCase() === wanted);
  return matches.length === 1 ? matches[0]!.id : null;
}

// Normalize each entity's list to `{ id, name }` (sessions expose `title` as the name).
async function listNamed(
  ownerId: string,
  campaignId: string,
  entity: ProposalEntity,
): Promise<{ id: string; name: string }[] | null> {
  switch (entity) {
    case "npc": {
      const rows = await listNpcsForOwnedCampaign(ownerId, campaignId);
      return rows && rows.map((r) => ({ id: r.id, name: r.name }));
    }
    case "location": {
      const rows = await listLocationsForOwner(ownerId, campaignId);
      return rows && rows.map((r) => ({ id: r.id, name: r.name }));
    }
    case "item": {
      const rows = await listItemsForOwner(ownerId, campaignId);
      return rows && rows.map((r) => ({ id: r.id, name: r.name }));
    }
    case "session": {
      const rows = await listSessionsForOwner(ownerId, campaignId);
      return rows && rows.map((r) => ({ id: r.id, name: r.title }));
    }
    case "character": {
      const rows = await listCharactersForOwner(ownerId, campaignId);
      return rows && rows.map((r) => ({ id: r.id, name: r.name }));
    }
  }
}

export async function commitProposal(
  ownerId: string,
  proposal: Proposal,
): Promise<CommitResult> {
  if (proposal.action === "create") return commitCreate(ownerId, proposal);
  // update/delete: resolve the target name to an id under the owned campaign first.
  const id = await resolveEntityIdByName(
    ownerId,
    proposal.campaignId,
    proposal.entity,
    proposal.target,
  );
  if (id === null) return { ok: false, reason: "not_found" };
  if (proposal.action === "update") return commitUpdate(ownerId, id, proposal);
  return commitDelete(ownerId, id, proposal.entity);
}

function created(row: { id: string } | null): CommitResult {
  return row ? { ok: true, id: row.id } : { ok: false, reason: "not_found" };
}

async function commitCreate(
  ownerId: string,
  p: Extract<Proposal, { action: "create" }>,
): Promise<CommitResult> {
  const { campaignId } = p;
  // Enrichment provenance (source/attribution) is persisted only for NPC/Character.
  const provenance = { source: p.source, attribution: p.attribution };
  switch (p.entity) {
    case "npc":
      return created(
        await createNpcForOwnedCampaign(ownerId, campaignId, p.fields, provenance),
      );
    case "location":
      return created(await createLocationForOwner(ownerId, campaignId, p.fields));
    case "item":
      try {
        return created(await createItemForOwner(ownerId, campaignId, p.fields));
      } catch (error) {
        if (error instanceof OwnerNpcNotInCampaignError) {
          return { ok: false, reason: "invalid" };
        }
        throw error;
      }
    case "session":
      return created(await createSessionForOwner(ownerId, campaignId, p.fields));
    case "character":
      return created(
        await createCharacterForOwner(ownerId, campaignId, p.fields, provenance),
      );
  }
}

async function commitUpdate(
  ownerId: string,
  id: string,
  p: Extract<Proposal, { action: "update" }>,
): Promise<CommitResult> {
  switch (p.entity) {
    case "npc":
      return created(await updateNpcForOwner(ownerId, id, p.fields));
    case "location":
      return created(await updateLocationForOwner(ownerId, id, p.fields));
    case "item":
      try {
        return created(await updateItemForOwner(ownerId, id, p.fields));
      } catch (error) {
        if (error instanceof OwnerNpcNotInCampaignError) {
          return { ok: false, reason: "invalid" };
        }
        throw error;
      }
    case "session":
      return created(await updateSessionForOwner(ownerId, id, p.fields));
    case "character":
      return created(await updateCharacterForOwner(ownerId, id, p.fields));
  }
}

async function commitDelete(
  ownerId: string,
  id: string,
  entity: ProposalEntity,
): Promise<CommitResult> {
  const deleted = await deleteForEntity(ownerId, id, entity);
  return deleted ? { ok: true, id } : { ok: false, reason: "not_found" };
}

function deleteForEntity(
  ownerId: string,
  id: string,
  entity: ProposalEntity,
): Promise<boolean> {
  switch (entity) {
    case "npc":
      return deleteNpcForOwner(ownerId, id);
    case "location":
      return deleteLocationForOwner(ownerId, id);
    case "item":
      return deleteItemForOwner(ownerId, id);
    case "session":
      return deleteSessionForOwner(ownerId, id);
    case "character":
      return deleteCharacterForOwner(ownerId, id);
  }
}
