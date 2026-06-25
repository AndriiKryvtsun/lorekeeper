import type { User } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock every server-side dependency so the router runs without SRD/LLM/Redis/Prisma.
vi.mock("@/lib/data/owned", () => ({ isOwnedCampaign: vi.fn() }));
vi.mock("@/lib/sdk/server/srd", () => ({ lookupSrd: vi.fn() }));
vi.mock("@/lib/ai/rate-limit", () => ({ enforceProposeRateLimit: vi.fn() }));
vi.mock("@/lib/ai/tiers", () => ({ getProvider: vi.fn() }));
vi.mock("@/lib/ai/audit", () => ({ auditProposalEvent: vi.fn() }));

const owned = await import("@/lib/data/owned");
const srd = await import("@/lib/sdk/server/srd");
const rl = await import("@/lib/ai/rate-limit");
const tiers = await import("@/lib/ai/tiers");
const { enrichmentRouter } = await import("~/server/api/routers/enrichment");
const { createCallerFactory } = await import("~/server/api/trpc");

const m = (fn: unknown) => fn as ReturnType<typeof vi.fn>;
const createCaller = createCallerFactory(enrichmentRouter);
const USER = { id: "user-1" } as unknown as User;
const authed = () => createCaller({ user: USER });

beforeEach(() => {
  vi.clearAllMocks();
  m(rl.enforceProposeRateLimit).mockResolvedValue({ ok: true });
  m(owned.isOwnedCampaign).mockResolvedValue(true);
  m(srd.lookupSrd).mockResolvedValue([
    {
      source: "srd",
      attribution: "OGL notice",
      label: "Goblin",
      data: { name: "Goblin", role: "Small humanoid", description: "AC 15", status: "alive" },
    },
  ]);
  m(tiers.getProvider).mockReturnValue({
    generate: vi.fn().mockResolvedValue({
      text: JSON.stringify({
        name: "Mysterious Stranger",
        role: "wanderer",
        status: "alive",
      }),
      usage: { inputTokens: 1, outputTokens: 1 },
    }),
  });
});

describe("proposeFromSrd", () => {
  it("returns unified create proposals tagged source=srd", async () => {
    const res = await authed().proposeFromSrd({
      kind: "npc",
      campaignId: "c1",
      query: "goblin",
    });
    expect(res.candidates).toHaveLength(1);
    expect(res.candidates[0]!.proposal).toMatchObject({
      action: "create",
      entity: "npc",
      campaignId: "c1",
      source: "srd",
      attribution: "OGL notice",
    });
    expect(res.candidates[0]!.proposal.fields.name).toBe("Goblin");
  });

  it("rejects a campaign the user does not own (404), without SRD work", async () => {
    m(owned.isOwnedCampaign).mockResolvedValue(false);
    await expect(
      authed().proposeFromSrd({ kind: "npc", campaignId: "other", query: "goblin" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(srd.lookupSrd).not.toHaveBeenCalled();
  });

  it("blocks when rate-limited, before ownership or SRD work", async () => {
    m(rl.enforceProposeRateLimit).mockResolvedValue({ ok: false, reason: "user" });
    await expect(
      authed().proposeFromSrd({ kind: "npc", campaignId: "c1", query: "goblin" }),
    ).rejects.toMatchObject({ code: "TOO_MANY_REQUESTS" });
    expect(owned.isOwnedCampaign).not.toHaveBeenCalled();
    expect(srd.lookupSrd).not.toHaveBeenCalled();
  });

  it("rejects SRD for characters (SRD is NPC-only)", async () => {
    await expect(
      authed().proposeFromSrd({ kind: "character", campaignId: "c1", query: "x" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});

describe("proposeFromAgent", () => {
  it("returns a unified create proposal tagged source=agent", async () => {
    const res = await authed().proposeFromAgent({
      kind: "npc",
      campaignId: "c1",
      prompt: "a mysterious stranger",
    });
    expect(res.proposal).toMatchObject({
      action: "create",
      entity: "npc",
      campaignId: "c1",
      source: "agent",
    });
    expect(res.proposal.fields.name).toBe("Mysterious Stranger");
  });

  it("enforces ownership", async () => {
    m(owned.isOwnedCampaign).mockResolvedValue(false);
    await expect(
      authed().proposeFromAgent({ kind: "character", campaignId: "other", prompt: "x" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("both sources share the unified proposal envelope", () => {
  it("SRD and agent proposals have the same create-envelope keys", async () => {
    const fromSrd = (
      await authed().proposeFromSrd({ kind: "npc", campaignId: "c1", query: "goblin" })
    ).candidates[0]!.proposal;
    const fromAgent = (
      await authed().proposeFromAgent({ kind: "npc", campaignId: "c1", prompt: "x" })
    ).proposal;

    expect(fromSrd.action).toBe(fromAgent.action);
    expect(fromSrd.entity).toBe(fromAgent.entity);
    expect(fromSrd.campaignId).toBe(fromAgent.campaignId);
    expect(typeof fromSrd.fields.name).toBe("string");
    expect(typeof fromAgent.fields.name).toBe("string");
  });
});
