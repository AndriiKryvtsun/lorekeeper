import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ExecuteActionInput } from "@/lib/data/action-registry";
import type { ActionKey } from "@/lib/validation/assistant-actions";

// Mock the owner-scoped data layer so no Prisma client is constructed. Each stub stands in for
// the real function the registry binds, letting us assert WHICH one a key invokes and with what.
vi.mock("@/lib/data/campaigns", () => ({
  createNpcForOwnedCampaign: vi.fn(),
  updateNpcForOwner: vi.fn(),
  deleteNpcForOwner: vi.fn(),
}));
vi.mock("@/lib/data/locations", () => ({
  createLocationForOwner: vi.fn(),
  updateLocationForOwner: vi.fn(),
  deleteLocationForOwner: vi.fn(),
}));
vi.mock("@/lib/data/items", () => ({
  createItemForOwner: vi.fn(),
  updateItemForOwner: vi.fn(),
  deleteItemForOwner: vi.fn(),
  OwnerNpcNotInCampaignError: class OwnerNpcNotInCampaignError extends Error {},
}));
vi.mock("@/lib/data/sessions", () => ({
  createSessionForOwner: vi.fn(),
  updateSessionForOwner: vi.fn(),
  deleteSessionForOwner: vi.fn(),
}));
vi.mock("@/lib/data/characters", () => ({
  createCharacterForOwner: vi.fn(),
  updateCharacterForOwner: vi.fn(),
  deleteCharacterForOwner: vi.fn(),
}));

const campaigns = await import("@/lib/data/campaigns");
const locations = await import("@/lib/data/locations");
const items = await import("@/lib/data/items");
const sessions = await import("@/lib/data/sessions");
const characters = await import("@/lib/data/characters");

const { ACTION_OPERATION_KEYS, assertRegistryBound, executeAction } = await import(
  "@/lib/data/action-registry"
);
const { ACTION_KEYS, ACTION_REGISTRY } = await import(
  "@/lib/validation/assistant-actions"
);

type Mock = ReturnType<typeof vi.fn>;
const m = (fn: unknown) => fn as Mock;

// The data-layer function each key must reach, and the argument list it must be handed.
const BINDINGS: Record<
  ActionKey,
  { fn: () => unknown; args: (o: string, c: string, t: string) => unknown[] }
> = {
  "create:npc": {
    fn: () => campaigns.createNpcForOwnedCampaign,
    args: (o, c) => [o, c, { name: "Sera" }, undefined],
  },
  "update:npc": {
    fn: () => campaigns.updateNpcForOwner,
    args: (o, _c, t) => [o, t, { name: "Sera" }],
  },
  "delete:npc": { fn: () => campaigns.deleteNpcForOwner, args: (o, _c, t) => [o, t] },

  "create:location": {
    fn: () => locations.createLocationForOwner,
    args: (o, c) => [o, c, { name: "Sera" }],
  },
  "update:location": {
    fn: () => locations.updateLocationForOwner,
    args: (o, _c, t) => [o, t, { name: "Sera" }],
  },
  "delete:location": {
    fn: () => locations.deleteLocationForOwner,
    args: (o, _c, t) => [o, t],
  },

  "create:item": {
    fn: () => items.createItemForOwner,
    args: (o, c) => [o, c, { name: "Sera" }],
  },
  "update:item": {
    fn: () => items.updateItemForOwner,
    args: (o, _c, t) => [o, t, { name: "Sera" }],
  },
  "delete:item": { fn: () => items.deleteItemForOwner, args: (o, _c, t) => [o, t] },

  "create:session": {
    fn: () => sessions.createSessionForOwner,
    args: (o, c) => [o, c, { name: "Sera" }],
  },
  "update:session": {
    fn: () => sessions.updateSessionForOwner,
    args: (o, _c, t) => [o, t, { name: "Sera" }],
  },
  "delete:session": {
    fn: () => sessions.deleteSessionForOwner,
    args: (o, _c, t) => [o, t],
  },

  "create:character": {
    fn: () => characters.createCharacterForOwner,
    args: (o, c) => [o, c, { name: "Sera" }, undefined],
  },
  "update:character": {
    fn: () => characters.updateCharacterForOwner,
    args: (o, _c, t) => [o, t, { name: "Sera" }],
  },
  "delete:character": {
    fn: () => characters.deleteCharacterForOwner,
    args: (o, _c, t) => [o, t],
  },
};

const OWNER = "user-1";
const CAMPAIGN = "camp-1";
const TARGET = "row-9";

function inputFor(key: ActionKey): ExecuteActionInput {
  const entry = ACTION_REGISTRY[key];
  return {
    ownerId: OWNER,
    entry,
    campaignId: CAMPAIGN,
    targetId: entry.action === "create" ? undefined : TARGET,
    payload: entry.action === "delete" ? undefined : { name: "Sera" },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("registry parity", () => {
  it("binds an operation for every registry key", () => {
    expect([...ACTION_OPERATION_KEYS].sort()).toEqual([...ACTION_KEYS].sort());
  });

  it("binds no operation that is not a registry key", () => {
    for (const key of ACTION_OPERATION_KEYS) {
      expect(ACTION_KEYS).toContain(key);
    }
  });

  it("assertRegistryBound passes for the shipped table", () => {
    expect(() => assertRegistryBound()).not.toThrow();
  });
});

describe("executeAction invokes the bound operation", () => {
  for (const key of Object.keys(BINDINGS) as ActionKey[]) {
    it(`${key} reaches its owner-scoped operation with the resolved arguments`, async () => {
      const binding = BINDINGS[key];
      const target = m(binding.fn());
      const entry = ACTION_REGISTRY[key];
      // delete returns a boolean; create/update return a row.
      target.mockResolvedValue(entry.action === "delete" ? true : { id: TARGET });

      const result = await executeAction(inputFor(key));

      expect(target).toHaveBeenCalledTimes(1);
      expect(target).toHaveBeenCalledWith(...binding.args(OWNER, CAMPAIGN, TARGET));
      expect(result).toEqual({ ok: true, id: TARGET, scope: entry.scope });
    });
  }

  it("reports the registry's scope, not one derived from the payload", async () => {
    m(campaigns.createNpcForOwnedCampaign).mockResolvedValue({ id: "npc-1" });
    const result = await executeAction(inputFor("create:npc"));
    expect(result.scope).toBe("campaign:npc:write");
  });
});

describe("execution takes no operation or scope from its caller", () => {
  it("ignores caller-supplied scope and operation fields", async () => {
    m(campaigns.createNpcForOwnedCampaign).mockResolvedValue({ id: "npc-1" });
    const rogue = vi.fn();
    // Widened past excess-property checking, as an untrusted caller's object would be.
    const tainted = {
      ...inputFor("create:npc"),
      scope: "campaign:everything:write",
      operation: rogue,
      method: "POST",
      path: "/api/anything",
    } as ExecuteActionInput;

    const result = await executeAction(tainted);

    expect(rogue).not.toHaveBeenCalled();
    expect(campaigns.createNpcForOwnedCampaign).toHaveBeenCalledTimes(1);
    expect(result.scope).toBe("campaign:npc:write");
  });
});

describe("refusals", () => {
  it("reports not_found when the campaign is not owned (existence not revealed)", async () => {
    // The owner-scoped create returns null both for an unowned campaign and a missing one.
    m(campaigns.createNpcForOwnedCampaign).mockResolvedValue(null);
    const unowned = await executeAction(inputFor("create:npc"));

    m(campaigns.createNpcForOwnedCampaign).mockResolvedValue(null);
    const missing = await executeAction({
      ...inputFor("create:npc"),
      campaignId: "does-not-exist",
    });

    expect(unowned).toEqual({ ok: false, reason: "not_found", scope: "campaign:npc:write" });
    expect(missing).toEqual(unowned);
  });

  it("reports not_found for an unowned update/delete without calling the operation twice", async () => {
    m(campaigns.updateNpcForOwner).mockResolvedValue(null);
    const result = await executeAction(inputFor("update:npc"));
    expect(result).toMatchObject({ ok: false, reason: "not_found" });
  });

  it("refuses an update or delete with no resolved target, without touching the data layer", async () => {
    const update = await executeAction({ ...inputFor("update:npc"), targetId: undefined });
    const remove = await executeAction({ ...inputFor("delete:npc"), targetId: undefined });
    expect(update).toMatchObject({ ok: false, reason: "not_found" });
    expect(remove).toMatchObject({ ok: false, reason: "not_found" });
    expect(campaigns.updateNpcForOwner).not.toHaveBeenCalled();
    expect(campaigns.deleteNpcForOwner).not.toHaveBeenCalled();
  });

  it("refuses a create or update with no payload, without touching the data layer", async () => {
    const result = await executeAction({ ...inputFor("create:npc"), payload: undefined });
    expect(result).toMatchObject({ ok: false, reason: "invalid" });
    expect(campaigns.createNpcForOwnedCampaign).not.toHaveBeenCalled();
  });

  it("maps an owner-NPC-outside-the-campaign item write to invalid, not a crash", async () => {
    m(items.createItemForOwner).mockRejectedValue(new items.OwnerNpcNotInCampaignError());
    const result = await executeAction(inputFor("create:item"));
    expect(result).toMatchObject({ ok: false, reason: "invalid" });
  });

  it("does not swallow an unexpected data-layer error", async () => {
    m(items.createItemForOwner).mockRejectedValue(new Error("db down"));
    await expect(executeAction(inputFor("create:item"))).rejects.toThrow("db down");
  });
});
