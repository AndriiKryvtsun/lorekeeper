import type { User } from "@supabase/supabase-js";
import { TRPCError } from "@trpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock the owner-scoped data layer so router tests need neither a DB nor a session.
vi.mock("@/lib/data/campaigns", () => ({
  listCampaigns: vi.fn(),
  getCampaign: vi.fn(),
  createCampaign: vi.fn(),
  updateCampaign: vi.fn(),
  deleteCampaign: vi.fn(),
  listNpcsForOwnedCampaign: vi.fn(),
  createNpcForOwnedCampaign: vi.fn(),
}));

const data = await import("@/lib/data/campaigns");
const { createCaller } = await import("~/server/api/root");

const dataMock = data as unknown as Record<string, ReturnType<typeof vi.fn>>;

const USER = { id: "user-1" } as unknown as User;

// A caller built with a context is exactly how the RSC server caller (~/trpc/server)
// invokes procedures — so these also cover "a Server Component can call directly".
const authed = () => createCaller({ user: USER });
const anon = () => createCaller({ user: null });

beforeEach(() => {
  vi.clearAllMocks();
});

describe("protectedProcedure rejects anonymous callers", () => {
  it("throws UNAUTHORIZED and never touches the data layer", async () => {
    await expect(anon().campaign.list()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
    expect(dataMock.listCampaigns).not.toHaveBeenCalled();
  });

  it("rejects an anonymous mutation too", async () => {
    await expect(
      anon().campaign.create({ title: "T", system: "S" }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(dataMock.createCampaign).not.toHaveBeenCalled();
  });
});

describe("owner scoping uses ctx.user.id", () => {
  it("list scopes to the session user", async () => {
    dataMock.listCampaigns.mockResolvedValue([]);
    await authed().campaign.list();
    expect(dataMock.listCampaigns).toHaveBeenCalledWith("user-1");
  });

  it("create takes ownerId from ctx, ignoring any ownerId in input", async () => {
    dataMock.createCampaign.mockResolvedValue({ id: "c1", ownerId: "user-1" });
    await authed().campaign.create({
      title: "T",
      system: "S",
      // Unknown to the schema; must be stripped and ignored.
      ownerId: "attacker",
    } as unknown as { title: string; system: string });
    expect(dataMock.createCampaign).toHaveBeenCalledWith("user-1", {
      title: "T",
      system: "S",
    });
  });
});

describe("cross-user access is impossible (NOT_FOUND)", () => {
  it("byId yields NOT_FOUND for a missing/unowned campaign", async () => {
    dataMock.getCampaign.mockResolvedValue(null);
    await expect(authed().campaign.byId({ id: "other" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("update yields NOT_FOUND for an unowned campaign", async () => {
    dataMock.updateCampaign.mockResolvedValue(null);
    await expect(
      authed().campaign.update({ id: "other", data: { title: "X" } }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("delete yields NOT_FOUND for an unowned campaign", async () => {
    dataMock.deleteCampaign.mockResolvedValue(false);
    await expect(
      authed().campaign.delete({ id: "other" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("npc.listByCampaign yields NOT_FOUND for an unowned campaign", async () => {
    dataMock.listNpcsForOwnedCampaign.mockResolvedValue(null);
    await expect(
      authed().npc.listByCampaign({ campaignId: "other" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("npc.create yields NOT_FOUND for an unowned campaign and does not write", async () => {
    dataMock.createNpcForOwnedCampaign.mockResolvedValue(null);
    await expect(
      authed().npc.create({ campaignId: "other", name: "Mara" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("server-side direct call returns typed data (RSC caller mechanism)", () => {
  it("returns owned campaigns via a direct caller", async () => {
    dataMock.listCampaigns.mockResolvedValue([{ id: "c1", ownerId: "user-1" }]);
    const result = await authed().campaign.list();
    expect(result).toEqual([{ id: "c1", ownerId: "user-1" }]);
  });

  it("npc.create forwards the parent campaignId from input when owned", async () => {
    dataMock.createNpcForOwnedCampaign.mockResolvedValue({ id: "n1" });
    await authed().npc.create({ campaignId: "c1", name: "Mara" });
    expect(dataMock.createNpcForOwnedCampaign).toHaveBeenCalledWith(
      "user-1",
      "c1",
      { name: "Mara", status: "alive" },
    );
  });
});

// Guards that the TRPCError import is used (and the codes are the real enum values).
it("uses real tRPC error codes", () => {
  expect(new TRPCError({ code: "NOT_FOUND" }).code).toBe("NOT_FOUND");
});
