import "server-only";

import {
  createNpcForOwnedCampaign,
  deleteNpcForOwner,
  updateNpcForOwner,
} from "@/lib/data/campaigns";
import {
  createCharacterForOwner,
  deleteCharacterForOwner,
  updateCharacterForOwner,
} from "@/lib/data/characters";
import {
  createItemForOwner,
  deleteItemForOwner,
  OwnerNpcNotInCampaignError,
  updateItemForOwner,
} from "@/lib/data/items";
import {
  createLocationForOwner,
  deleteLocationForOwner,
  updateLocationForOwner,
} from "@/lib/data/locations";
import {
  createSessionForOwner,
  deleteSessionForOwner,
  updateSessionForOwner,
} from "@/lib/data/sessions";
import {
  ACTION_KEYS,
  actionKey,
  type ActionEntity,
  type ActionEntry,
  type ActionKey,
  type ScopeString,
  createPayloadSchemas,
  updatePayloadSchemas,
} from "@/lib/validation/assistant-actions";
import type { ProposalSource } from "@/lib/validation/assistant-proposal";
import type { z } from "zod";

// The SERVER half of the action registry: each registry key bound to exactly one owner-scoped
// operation. This file is `server-only` because those operations reach Prisma; the isomorphic
// half (payload schemas, scopes, envelope) lives in `lib/validation/assistant-actions.ts`.
//
// The table is typed as an exhaustive `Record<ActionKey, ...>`, so a key that gains an entry
// there without a binding here — or vice versa — fails `npx tsc --noEmit` rather than at
// runtime. `ACTION_OPERATION_KEYS` lets a test assert the same parity in both directions.

export type ActionResult =
  | { ok: true; id: string }
  | { ok: false; reason: "not_found" | "invalid" };

// Enrichment provenance, carried through a create untouched (entity-enrichment).
export type ActionProvenance = { source?: ProposalSource; attribution?: string };

// What an operation is given. `ownerId` and `campaignId` are REQUIRED by the type, which is how
// "the declared scope is ownership-backed" is enforced by construction: an operation cannot be
// bound here unless it is owner-scoped. There is deliberately no field for a method, a path, or
// a scope — those come from the registry, never from a caller.
export type ActionInput<P = unknown> = {
  readonly ownerId: string;
  readonly campaignId: string;
  // update/delete: the target id already resolved WITHIN the owned campaign. Never model-supplied.
  readonly targetId?: string;
  readonly payload?: P;
  readonly provenance?: ActionProvenance;
};

export type ActionOperation<P = unknown> = (
  input: ActionInput<P>,
) => Promise<ActionResult>;

// The payload type of a given key, taken from that key's schema so the binding below receives
// exactly the entity's validated input (no `any`, no per-entity restating of field types).
type PayloadForKey<K extends ActionKey> = K extends `create:${infer E extends ActionEntity}`
  ? z.infer<(typeof createPayloadSchemas)[E]>
  : K extends `update:${infer E extends ActionEntity}`
    ? z.infer<(typeof updatePayloadSchemas)[E]>
    : never;

type ActionOperations = { [K in ActionKey]: ActionOperation<PayloadForKey<K>> };

// Shape adapters. They exist so each binding below is one line naming its operation, and so
// "missing target" / "missing payload" are refused here rather than reaching Prisma half-formed.
type Row = { id: string } | null;

const created = (row: Row): ActionResult =>
  row ? { ok: true, id: row.id } : { ok: false, reason: "not_found" };

function onCreate<P>(
  run: (
    payload: P,
    ownerId: string,
    campaignId: string,
    provenance: ActionProvenance | undefined,
  ) => Promise<Row>,
): ActionOperation<P> {
  return async ({ ownerId, campaignId, payload, provenance }) => {
    if (payload === undefined) return { ok: false, reason: "invalid" };
    return created(await run(payload, ownerId, campaignId, provenance));
  };
}

function onUpdate<P>(
  run: (payload: P, ownerId: string, id: string) => Promise<Row>,
): ActionOperation<P> {
  return async ({ ownerId, targetId, payload }) => {
    if (!targetId) return { ok: false, reason: "not_found" };
    if (payload === undefined) return { ok: false, reason: "invalid" };
    return created(await run(payload, ownerId, targetId));
  };
}

function onDelete(
  run: (ownerId: string, id: string) => Promise<boolean>,
): ActionOperation<never> {
  return async ({ ownerId, targetId }) => {
    if (!targetId) return { ok: false, reason: "not_found" };
    const ok = await run(ownerId, targetId);
    return ok ? { ok: true, id: targetId } : { ok: false, reason: "not_found" };
  };
}

// An item write can name an owner NPC outside the campaign; the data layer throws, and that is a
// bad payload rather than a missing row.
function guardItemOwner<P>(operation: ActionOperation<P>): ActionOperation<P> {
  return async (input) => {
    try {
      return await operation(input);
    } catch (error) {
      if (error instanceof OwnerNpcNotInCampaignError) {
        return { ok: false, reason: "invalid" };
      }
      throw error;
    }
  };
}

const ACTION_OPERATIONS: ActionOperations = {
  "create:npc": onCreate((payload, ownerId, campaignId, provenance) =>
    createNpcForOwnedCampaign(ownerId, campaignId, payload, provenance),
  ),
  "update:npc": onUpdate((payload, ownerId, id) =>
    updateNpcForOwner(ownerId, id, payload),
  ),
  "delete:npc": onDelete((ownerId, id) => deleteNpcForOwner(ownerId, id)),

  "create:location": onCreate((payload, ownerId, campaignId) =>
    createLocationForOwner(ownerId, campaignId, payload),
  ),
  "update:location": onUpdate((payload, ownerId, id) =>
    updateLocationForOwner(ownerId, id, payload),
  ),
  "delete:location": onDelete((ownerId, id) => deleteLocationForOwner(ownerId, id)),

  "create:item": guardItemOwner(
    onCreate((payload, ownerId, campaignId) =>
      createItemForOwner(ownerId, campaignId, payload),
    ),
  ),
  "update:item": guardItemOwner(
    onUpdate((payload, ownerId, id) => updateItemForOwner(ownerId, id, payload)),
  ),
  "delete:item": onDelete((ownerId, id) => deleteItemForOwner(ownerId, id)),

  "create:session": onCreate((payload, ownerId, campaignId) =>
    createSessionForOwner(ownerId, campaignId, payload),
  ),
  "update:session": onUpdate((payload, ownerId, id) =>
    updateSessionForOwner(ownerId, id, payload),
  ),
  "delete:session": onDelete((ownerId, id) => deleteSessionForOwner(ownerId, id)),

  "create:character": onCreate((payload, ownerId, campaignId, provenance) =>
    createCharacterForOwner(ownerId, campaignId, payload, provenance),
  ),
  "update:character": onUpdate((payload, ownerId, id) =>
    updateCharacterForOwner(ownerId, id, payload),
  ),
  "delete:character": onDelete((ownerId, id) => deleteCharacterForOwner(ownerId, id)),
};

// The bound keys, for the parity test against the isomorphic registry.
export const ACTION_OPERATION_KEYS = Object.keys(ACTION_OPERATIONS) as ActionKey[];

// What `executeAction` was given. The entry comes from the registry; there is no field for an
// operation, a path, or a scope, so a caller cannot influence what runs or under what authority.
export type ExecuteActionInput = {
  readonly ownerId: string;
  readonly entry: ActionEntry;
  readonly campaignId: string;
  readonly targetId?: string;
  readonly payload?: unknown;
  readonly provenance?: ActionProvenance;
};

// Deterministic execution: the operation and the scope are looked up from the registry entry and
// the operation is invoked with the already-validated payload. The model is not in this path.
export async function executeAction(
  input: ExecuteActionInput,
): Promise<ActionResult & { scope: ScopeString }> {
  const { ownerId, entry, campaignId, targetId, payload, provenance } = input;
  const key = actionKey(entry.action, entry.entity);
  // One cast at the boundary: the payload is typed `unknown` until the validator has produced it,
  // and by then it satisfies this key's schema (that is what the validator checks).
  const operation = ACTION_OPERATIONS[key] as ActionOperation<never>;
  const result = await operation({
    ownerId,
    campaignId,
    targetId,
    payload: payload as never,
    provenance,
  });
  // The scope is always the registry's, reported for audit/telemetry.
  return { ...result, scope: entry.scope };
}

// Every registry key has a binding (asserted at module load in development builds too, so a
// hand-edited table cannot ship half-bound).
export function assertRegistryBound(): void {
  for (const key of ACTION_KEYS) {
    if (!(key in ACTION_OPERATIONS)) {
      throw new Error(`action registry: no operation bound for "${key}"`);
    }
  }
}
