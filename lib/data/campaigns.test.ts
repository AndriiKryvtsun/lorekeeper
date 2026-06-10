import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock the Prisma client to assert that every query is owner-scoped.
vi.mock("@/lib/prisma", () => ({
  prisma: {
    campaign: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      deleteMany: vi.fn(),
    },
    nPC: { findMany: vi.fn(), create: vi.fn() },
  },
}));

const { prisma } = await import("@/lib/prisma");
const {
  listCampaigns,
  getCampaign,
  createCampaign,
  updateCampaign,
  deleteCampaign,
  listNpcsForOwnedCampaign,
  createNpcForOwnedCampaign,
} = await import("./campaigns");

const p = prisma as unknown as {
  campaign: Record<string, ReturnType<typeof vi.fn>>;
  nPC: Record<string, ReturnType<typeof vi.fn>>;
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("listCampaigns", () => {
  it("filters by ownerId", async () => {
    p.campaign.findMany.mockResolvedValue([]);
    await listCampaigns("user-1");
    expect(p.campaign.findMany).toHaveBeenCalledWith({
      where: { ownerId: "user-1" },
      orderBy: { createdAt: "desc" },
    });
  });
});

describe("getCampaign", () => {
  it("scopes the lookup by id AND ownerId", async () => {
    p.campaign.findFirst.mockResolvedValue(null);
    await getCampaign("user-1", "c1");
    expect(p.campaign.findFirst).toHaveBeenCalledWith({
      where: { id: "c1", ownerId: "user-1" },
    });
  });
});

describe("createCampaign", () => {
  it("injects ownerId into the created row", async () => {
    p.campaign.create.mockResolvedValue({ id: "c1" });
    await createCampaign("user-1", { title: "T", system: "S" });
    expect(p.campaign.create).toHaveBeenCalledWith({
      data: { title: "T", system: "S", ownerId: "user-1" },
    });
  });
});

describe("updateCampaign", () => {
  it("returns null when the campaign is not owned (no update)", async () => {
    p.campaign.findFirst.mockResolvedValue(null);
    const result = await updateCampaign("user-1", "other", { title: "X" });
    expect(result).toBeNull();
    expect(p.campaign.update).not.toHaveBeenCalled();
  });

  it("updates by id once ownership is confirmed", async () => {
    p.campaign.findFirst.mockResolvedValue({ id: "c1" });
    p.campaign.update.mockResolvedValue({ id: "c1", title: "X" });
    const result = await updateCampaign("user-1", "c1", { title: "X" });
    expect(result).toEqual({ id: "c1", title: "X" });
  });
});

describe("deleteCampaign", () => {
  it("deletes scoped by owner and reports whether a row matched", async () => {
    p.campaign.deleteMany.mockResolvedValue({ count: 1 });
    const ok = await deleteCampaign("user-1", "c1");
    expect(ok).toBe(true);
    expect(p.campaign.deleteMany).toHaveBeenCalledWith({
      where: { id: "c1", ownerId: "user-1" },
    });
  });

  it("returns false when nothing matched", async () => {
    p.campaign.deleteMany.mockResolvedValue({ count: 0 });
    expect(await deleteCampaign("user-1", "other")).toBe(false);
  });
});

describe("NPC access requires an owned parent campaign", () => {
  it("listNpcsForOwnedCampaign returns null for an unowned campaign", async () => {
    p.campaign.findFirst.mockResolvedValue(null);
    const result = await listNpcsForOwnedCampaign("user-1", "other");
    expect(result).toBeNull();
    expect(p.nPC.findMany).not.toHaveBeenCalled();
  });

  it("createNpcForOwnedCampaign returns null for an unowned campaign (no write)", async () => {
    p.campaign.findFirst.mockResolvedValue(null);
    const result = await createNpcForOwnedCampaign("user-1", "other", {
      name: "Mara",
      status: "alive",
    });
    expect(result).toBeNull();
    expect(p.nPC.create).not.toHaveBeenCalled();
  });

  it("createNpcForOwnedCampaign sets the parent from the path when owned", async () => {
    p.campaign.findFirst.mockResolvedValue({ id: "c1" });
    p.nPC.create.mockResolvedValue({ id: "n1" });
    await createNpcForOwnedCampaign("user-1", "c1", { name: "Mara", status: "alive" });
    expect(p.nPC.create).toHaveBeenCalledWith({
      data: { name: "Mara", status: "alive", campaignId: "c1" },
    });
  });
});
