import type { User } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock every child data module so router tests need neither a DB nor a session.
vi.mock("@/lib/data/campaigns", () => ({
  // npc update/delete live here; other campaign fns are unused in this file.
  updateNpcForOwner: vi.fn(),
  deleteNpcForOwner: vi.fn(),
  listNpcsForOwnedCampaign: vi.fn(),
  createNpcForOwnedCampaign: vi.fn(),
  listCampaigns: vi.fn(),
  getCampaign: vi.fn(),
  createCampaign: vi.fn(),
  updateCampaign: vi.fn(),
  deleteCampaign: vi.fn(),
}));
vi.mock("@/lib/data/sessions", () => ({
  listSessionsForOwner: vi.fn(),
  createSessionForOwner: vi.fn(),
  updateSessionForOwner: vi.fn(),
  deleteSessionForOwner: vi.fn(),
}));
vi.mock("@/lib/data/locations", () => ({
  listLocationsForOwner: vi.fn(),
  createLocationForOwner: vi.fn(),
  updateLocationForOwner: vi.fn(),
  deleteLocationForOwner: vi.fn(),
}));
vi.mock("@/lib/data/items", () => ({
  OwnerNpcNotInCampaignError: class extends Error {},
  listItemsForOwner: vi.fn(),
  createItemForOwner: vi.fn(),
  updateItemForOwner: vi.fn(),
  deleteItemForOwner: vi.fn(),
}));
vi.mock("@/lib/data/characters", () => ({
  listCharactersForOwner: vi.fn(),
  createCharacterForOwner: vi.fn(),
  updateCharacterForOwner: vi.fn(),
  deleteCharacterForOwner: vi.fn(),
}));

const campaignsData = await import("@/lib/data/campaigns");
const sessionsData = await import("@/lib/data/sessions");
const locationsData = await import("@/lib/data/locations");
const charactersData = await import("@/lib/data/characters");
const { createCaller } = await import("~/server/api/root");

const m = (fn: unknown) => fn as ReturnType<typeof vi.fn>;
const USER = { id: "user-1" } as unknown as User;
const authed = () => createCaller({ user: USER });
const anon = () => createCaller({ user: null });

beforeEach(() => {
  vi.clearAllMocks();
});

describe("anonymous callers are rejected on child procedures", () => {
  it("session.listByCampaign → UNAUTHORIZED", async () => {
    await expect(
      anon().session.listByCampaign({ campaignId: "c1" }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(sessionsData.listSessionsForOwner).not.toHaveBeenCalled();
  });

  it("character.create → UNAUTHORIZED", async () => {
    await expect(
      anon().character.create({
        campaignId: "c1",
        name: "A",
        playerName: "P",
        class: "Bard",
        level: 1,
      }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});

describe("NPC update/delete enforce ownership", () => {
  it("update of an unowned NPC → NOT_FOUND", async () => {
    m(campaignsData.updateNpcForOwner).mockResolvedValue(null);
    await expect(
      authed().npc.update({ id: "n1", data: { name: "X" } }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("delete of an unowned NPC → NOT_FOUND", async () => {
    m(campaignsData.deleteNpcForOwner).mockResolvedValue(false);
    await expect(authed().npc.delete({ id: "n1" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});

describe("session/location/character cross-user access → NOT_FOUND", () => {
  it("session list/update/delete", async () => {
    m(sessionsData.listSessionsForOwner).mockResolvedValue(null);
    m(sessionsData.updateSessionForOwner).mockResolvedValue(null);
    m(sessionsData.deleteSessionForOwner).mockResolvedValue(false);
    await expect(
      authed().session.listByCampaign({ campaignId: "c1" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      authed().session.update({ id: "s1", data: { title: "X" } }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(authed().session.delete({ id: "s1" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("location list/update/delete", async () => {
    m(locationsData.listLocationsForOwner).mockResolvedValue(null);
    m(locationsData.updateLocationForOwner).mockResolvedValue(null);
    m(locationsData.deleteLocationForOwner).mockResolvedValue(false);
    await expect(
      authed().location.listByCampaign({ campaignId: "c1" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      authed().location.update({ id: "l1", data: { name: "X" } }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(authed().location.delete({ id: "l1" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("character list/delete", async () => {
    m(charactersData.listCharactersForOwner).mockResolvedValue(null);
    m(charactersData.deleteCharacterForOwner).mockResolvedValue(false);
    await expect(
      authed().character.listByCampaign({ campaignId: "c1" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      authed().character.delete({ id: "ch1" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("owner-scoped success path forwards campaignId from input", () => {
  it("session.create passes campaignId to the data layer", async () => {
    m(sessionsData.createSessionForOwner).mockResolvedValue({ id: "s1" });
    await authed().session.create({
      campaignId: "c1",
      title: "Session 1",
      date: new Date("2026-01-01T00:00:00.000Z"),
    });
    expect(sessionsData.createSessionForOwner).toHaveBeenCalledWith(
      "user-1",
      "c1",
      expect.objectContaining({ title: "Session 1" }),
    );
  });
});
