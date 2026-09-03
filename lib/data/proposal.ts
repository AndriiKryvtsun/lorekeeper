import "server-only";

import { executeAction } from "@/lib/data/action-registry";
import { listNpcsForOwnedCampaign } from "@/lib/data/campaigns";
import { listCharactersForOwner } from "@/lib/data/characters";
import { listItemsForOwner } from "@/lib/data/items";
import { listLocationsForOwner } from "@/lib/data/locations";
import { listSessionsForOwner } from "@/lib/data/sessions";
import { resolveActionKey } from "@/lib/validation/assistant-actions";
import type { Proposal, ProposalEntity } from "@/lib/validation/assistant-proposal";
// Commit a confirmed proposal through the EXISTING owner-scoped data layer. The model is not
// in this path — only typed, already-validated data reaches here. Ownership is re-checked by
// each data-layer function (a wrong owner/missing parent yields null → reported as not_found).

export type CommitResult =
  | { ok: true; id: string }
  | { ok: false; reason: "not_found" | "invalid" };

// The outcome of resolving a named target. "none" and "many" are DISTINCT so the caller can ask
// the right question — "none" needs the exact name, "many" needs to know which one — instead of
// collapsing both into one vague reply. Only "one" is writable.
export type TargetResolution =
  | { kind: "one"; id: string }
  | { kind: "none" }
  // The matched display names, in row order. An unowned or missing campaign resolves to "none",
  // so a name here always belongs to the requesting owner.
  | { kind: "many"; candidates: string[] };

// Resolve an entity's existing name to its id WITHIN an owned campaign. An unowned or missing
// campaign resolves to "none" — indistinguishable from a name that matches nothing — so nothing
// about another owner's data is revealed. Matching is case-insensitive on the display name.
export async function resolveEntityTarget(
  ownerId: string,
  campaignId: string,
  entity: ProposalEntity,
  name: string,
): Promise<TargetResolution> {
  const wanted = name.trim().toLowerCase();
  const rows = await listNamed(ownerId, campaignId, entity);
  if (rows === null) return { kind: "none" };
  const matches = rows.filter((r) => r.name.trim().toLowerCase() === wanted);
  if (matches.length === 1) return { kind: "one", id: matches[0]!.id };
  if (matches.length === 0) return { kind: "none" };
  return { kind: "many", candidates: matches.map((r) => r.name) };
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

// Commit a confirmed proposal. The operation and its required scope are resolved from the ACTION
// REGISTRY — this function no longer knows how to write any particular entity, so there is no
// second path by which a write could happen. The model is not in this path: only an
// already-validated payload reaches here, and ownership is re-checked inside the bound operation.
export async function commitProposal(
  ownerId: string,
  proposal: Proposal,
): Promise<CommitResult> {
  const resolution = resolveActionKey(proposal.action, proposal.entity);
  // Not executable: no registry entry binds this (action, entity) pair.
  if (!resolution.ok) return { ok: false, reason: "invalid" };
  const entry = resolution.entry;

  // update/delete: resolve the target name to an id under the owned campaign first. An absent or
  // ambiguous target is not writable.
  let targetId: string | undefined;
  if (proposal.action !== "create") {
    const target = await resolveEntityTarget(
      ownerId,
      proposal.campaignId,
      proposal.entity,
      proposal.target,
    );
    if (target.kind !== "one") return { ok: false, reason: "not_found" };
    targetId = target.id;
  }

  // Enrichment provenance (source/attribution) rides along on a create, untouched.
  const result = await executeAction({
    ownerId,
    entry,
    campaignId: proposal.campaignId,
    targetId,
    payload: proposal.action === "delete" ? undefined : proposal.fields,
    provenance:
      proposal.action === "create"
        ? { source: proposal.source, attribution: proposal.attribution }
        : undefined,
  });
  // The scope the write ran under is the registry's; callers audit it from the entry.
  return result.ok ? { ok: true, id: result.id } : { ok: false, reason: result.reason };
}
