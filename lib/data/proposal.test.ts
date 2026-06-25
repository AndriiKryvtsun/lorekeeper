import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Proposal } from "@/lib/validation/assistant-proposal";

// Mock the owner-scoped data layer so no DB is touched. The proposal commit must dispatch to
// these existing functions; the model is never in this path.
vi.mock("@/lib/data/campaigns", () => ({
  listNpcsForOwnedCampaign: vi.fn(),
  createNpcForOwnedCampaign: vi.fn(),
  updateNpcForOwner: vi.fn(),
  deleteNpcForOwner: vi.fn(),
}));
vi.mock("@/lib/data/characters", () => ({
  listCharactersForOwner: vi.fn(),
  createCharacterForOwner: vi.fn(),
  updateCharacterForOwner: vi.fn(),
  deleteCharacterForOwner: vi.fn(),
}));
vi.mock("@/lib/data/items", () => ({
  OwnerNpcNotInCampaignError: class extends Error {},
  listItemsForOwner: vi.fn(),
  createItemForOwner: vi.fn(),
  updateItemForOwner: vi.fn(),
  deleteItemForOwner: vi.fn(),
}));
vi.mock("@/lib/data/locations", () => ({
  listLocationsForOwner: vi.fn(),
  createLocationForOwner: vi.fn(),
  updateLocationForOwner: vi.fn(),
  deleteLocationForOwner: vi.fn(),
}));
vi.mock("@/lib/data/sessions", () => ({
  listSessionsForOwner: vi.fn(),
  createSessionForOwner: vi.fn(),
  updateSessionForOwner: vi.fn(),
  deleteSessionForOwner: vi.fn(),
}));

const campaigns = await import("@/lib/data/campaigns");
const items = await import("@/lib/data/items");
const sessions = await import("@/lib/data/sessions");
const { commitProposal, resolveEntityIdByName } = await import("@/lib/data/proposal");

const m = (fn: unknown) => fn as ReturnType<typeof vi.fn>;
const OWNER = "user-1";

beforeEach(() => vi.clearAllMocks());

describe("resolveEntityIdByName", () => {
  it("resolves a unique case-insensitive name to its id", async () => {
    m(campaigns.listNpcsForOwnedCampaign).mockResolvedValue([
      { id: "n1", name: "Bob" },
      { id: "n2", name: "Sara" },
    ]);
    expect(await resolveEntityIdByName(OWNER, "c1", "npc", "bob")).toBe("n1");
  });

  it("returns null for zero matches and for ambiguous (multiple) matches", async () => {
    m(campaigns.listNpcsForOwnedCampaign).mockResolvedValue([
      { id: "n1", name: "Bob" },
      { id: "n2", name: "Bob" },
    ]);
    expect(await resolveEntityIdByName(OWNER, "c1", "npc", "bob")).toBeNull();
    expect(await resolveEntityIdByName(OWNER, "c1", "npc", "nobody")).toBeNull();
  });

  it("returns null when the campaign is not owned (list is null)", async () => {
    m(campaigns.listNpcsForOwnedCampaign).mockResolvedValue(null);
    expect(await resolveEntityIdByName(OWNER, "c1", "npc", "bob")).toBeNull();
  });

  it("matches sessions by their title", async () => {
    m(sessions.listSessionsForOwner).mockResolvedValue([{ id: "s1", title: "Intro" }]);
    expect(await resolveEntityIdByName(OWNER, "c1", "session", "intro")).toBe("s1");
  });
});

describe("commitProposal", () => {
  it("creates through the owner-scoped data layer and returns the new id", async () => {
    m(campaigns.createNpcForOwnedCampaign).mockResolvedValue({ id: "n9" });
    const proposal: Proposal = {
      action: "create",
      entity: "npc",
      campaignId: "c1",
      fields: { name: "Sera", status: "alive" },
    };
    expect(await commitProposal(OWNER, proposal)).toEqual({ ok: true, id: "n9" });
    // An untagged proposal forwards undefined provenance (4th arg) — still the one path.
    expect(campaigns.createNpcForOwnedCampaign).toHaveBeenCalledWith(
      OWNER,
      "c1",
      { name: "Sera", status: "alive" },
      { source: undefined, attribution: undefined },
    );
  });

  it("reports not_found when the create returns null (cross-user / missing campaign)", async () => {
    m(campaigns.createNpcForOwnedCampaign).mockResolvedValue(null);
    const proposal: Proposal = {
      action: "create",
      entity: "npc",
      campaignId: "c1",
      fields: { name: "Sera", status: "alive" },
    };
    expect(await commitProposal(OWNER, proposal)).toEqual({ ok: false, reason: "not_found" });
  });

  it("maps an out-of-campaign item owner to an 'invalid' result", async () => {
    m(items.createItemForOwner).mockRejectedValue(new items.OwnerNpcNotInCampaignError());
    const proposal: Proposal = {
      action: "create",
      entity: "item",
      campaignId: "c1",
      fields: { name: "Lantern", ownerNpcId: "outsider" },
    };
    expect(await commitProposal(OWNER, proposal)).toEqual({ ok: false, reason: "invalid" });
  });

  it("update resolves the target name then dispatches to updateNpcForOwner", async () => {
    m(campaigns.listNpcsForOwnedCampaign).mockResolvedValue([{ id: "n1", name: "Sera" }]);
    m(campaigns.updateNpcForOwner).mockResolvedValue({ id: "n1" });
    const proposal: Proposal = {
      action: "update",
      entity: "npc",
      campaignId: "c1",
      target: "Sera",
      fields: { role: "captain" },
    };
    expect(await commitProposal(OWNER, proposal)).toEqual({ ok: true, id: "n1" });
    expect(campaigns.updateNpcForOwner).toHaveBeenCalledWith(OWNER, "n1", { role: "captain" });
  });

  it("does not write when an update target cannot be resolved", async () => {
    m(campaigns.listNpcsForOwnedCampaign).mockResolvedValue([]); // no match
    const proposal: Proposal = {
      action: "update",
      entity: "npc",
      campaignId: "c1",
      target: "Ghost",
      fields: { role: "captain" },
    };
    expect(await commitProposal(OWNER, proposal)).toEqual({ ok: false, reason: "not_found" });
    expect(campaigns.updateNpcForOwner).not.toHaveBeenCalled();
  });

  it("delete resolves then dispatches to deleteNpcForOwner", async () => {
    m(campaigns.listNpcsForOwnedCampaign).mockResolvedValue([{ id: "n1", name: "Sera" }]);
    m(campaigns.deleteNpcForOwner).mockResolvedValue(true);
    const proposal: Proposal = {
      action: "delete",
      entity: "npc",
      campaignId: "c1",
      target: "Sera",
    };
    expect(await commitProposal(OWNER, proposal)).toEqual({ ok: true, id: "n1" });
    expect(campaigns.deleteNpcForOwner).toHaveBeenCalledWith(OWNER, "n1");
  });
});
