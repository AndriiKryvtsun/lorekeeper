import { beforeEach, describe, expect, it, vi } from "vitest";

// Both enrichment sources commit through the ONE existing path. Mock the owner-scoped data
// layer and assert commitProposal forwards source/attribution for NPC/Character creates.
vi.mock("@/lib/data/campaigns", () => ({
  createNpcForOwnedCampaign: vi.fn(),
  listNpcsForOwnedCampaign: vi.fn(),
  updateNpcForOwner: vi.fn(),
  deleteNpcForOwner: vi.fn(),
}));
vi.mock("@/lib/data/characters", () => ({
  createCharacterForOwner: vi.fn(),
  listCharactersForOwner: vi.fn(),
  updateCharacterForOwner: vi.fn(),
  deleteCharacterForOwner: vi.fn(),
}));
vi.mock("@/lib/data/locations", () => ({
  createLocationForOwner: vi.fn(),
  listLocationsForOwner: vi.fn(),
  updateLocationForOwner: vi.fn(),
  deleteLocationForOwner: vi.fn(),
}));
vi.mock("@/lib/data/items", () => ({
  createItemForOwner: vi.fn(),
  listItemsForOwner: vi.fn(),
  updateItemForOwner: vi.fn(),
  deleteItemForOwner: vi.fn(),
  OwnerNpcNotInCampaignError: class extends Error {},
}));
vi.mock("@/lib/data/sessions", () => ({
  createSessionForOwner: vi.fn(),
  listSessionsForOwner: vi.fn(),
  updateSessionForOwner: vi.fn(),
  deleteSessionForOwner: vi.fn(),
}));

const campaigns = await import("@/lib/data/campaigns");
const characters = await import("@/lib/data/characters");
const { commitProposal } = await import("@/lib/data/proposal");
const { parseProposal } = await import("@/lib/validation/assistant-proposal");

const m = (fn: unknown) => fn as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  m(campaigns.createNpcForOwnedCampaign).mockResolvedValue({ id: "npc-1" });
  m(characters.createCharacterForOwner).mockResolvedValue({ id: "char-1" });
});

describe("commit persists provenance via the single path", () => {
  it("forwards source + attribution for an SRD-sourced NPC", async () => {
    const proposal = parseProposal({
      action: "create",
      entity: "npc",
      campaignId: "c1",
      fields: { name: "Goblin", status: "alive" },
      source: "srd",
      attribution: "OGL notice",
    });
    expect(proposal).not.toBeNull();

    const res = await commitProposal("owner-1", proposal!);
    expect(res).toEqual({ ok: true, id: "npc-1" });
    expect(campaigns.createNpcForOwnedCampaign).toHaveBeenCalledWith(
      "owner-1",
      "c1",
      expect.objectContaining({ name: "Goblin" }),
      { source: "srd", attribution: "OGL notice" },
    );
  });

  it("forwards source for an agent-sourced Character (no attribution)", async () => {
    const proposal = parseProposal({
      action: "create",
      entity: "character",
      campaignId: "c1",
      fields: { name: "Aria", playerName: "Sam", class: "Bard", level: 1 },
      source: "agent",
    });
    const res = await commitProposal("owner-1", proposal!);
    expect(res).toEqual({ ok: true, id: "char-1" });
    expect(characters.createCharacterForOwner).toHaveBeenCalledWith(
      "owner-1",
      "c1",
      expect.objectContaining({ name: "Aria" }),
      { source: "agent", attribution: undefined },
    );
  });

  it("drops attribution when the source is not SRD", () => {
    const proposal = parseProposal({
      action: "create",
      entity: "npc",
      campaignId: "c1",
      fields: { name: "X", status: "alive" },
      source: "agent",
      attribution: "should-be-ignored",
    });
    expect(proposal).toMatchObject({ source: "agent", attribution: undefined });
  });
});
