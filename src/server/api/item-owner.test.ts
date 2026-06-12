import type { User } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock Prisma so the REAL item data layer + router run without a database. This exercises
// the owner-NPC integrity rule end-to-end (data layer throws → router maps to BAD_REQUEST).
vi.mock("@/lib/prisma", () => ({
  prisma: {
    campaign: { findFirst: vi.fn() },
    nPC: { findFirst: vi.fn() },
    item: { create: vi.fn() },
  },
}));

const { prisma } = await import("@/lib/prisma");
const { createCaller } = await import("~/server/api/root");

const p = prisma as unknown as {
  campaign: { findFirst: ReturnType<typeof vi.fn> };
  nPC: { findFirst: ReturnType<typeof vi.fn> };
  item: { create: ReturnType<typeof vi.fn> };
};
const authed = () =>
  createCaller({ user: { id: "user-1" } as unknown as User });

beforeEach(() => {
  vi.clearAllMocks();
  // Campaign is owned by the user.
  p.campaign.findFirst.mockResolvedValue({ id: "c1" });
});

describe("item ownerNpcId must reference an NPC in the same campaign", () => {
  it("rejects an owner NPC outside the campaign with BAD_REQUEST and does not create", async () => {
    p.nPC.findFirst.mockResolvedValue(null); // NPC not found in this campaign
    await expect(
      authed().item.create({
        campaignId: "c1",
        name: "Sword",
        ownerNpcId: "npc-from-elsewhere",
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(p.item.create).not.toHaveBeenCalled();
  });

  it("allows an owner NPC that is in the campaign", async () => {
    p.nPC.findFirst.mockResolvedValue({ id: "npc-1" });
    p.item.create.mockResolvedValue({ id: "i1", name: "Sword" });
    const result = await authed().item.create({
      campaignId: "c1",
      name: "Sword",
      ownerNpcId: "npc-1",
    });
    expect(result).toMatchObject({ id: "i1" });
    expect(p.item.create).toHaveBeenCalled();
  });
});
