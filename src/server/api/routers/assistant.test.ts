import type { User } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock the commit (data layer) and the audit sink. The router under test must enforce
// confirm-before-write: it validates, delegates to commitProposal, and audits the outcome.
vi.mock("@/lib/data/proposal", () => ({ commitProposal: vi.fn() }));
vi.mock("@/lib/ai/audit", () => ({ auditProposalEvent: vi.fn() }));

const proposalData = await import("@/lib/data/proposal");
const audit = await import("@/lib/ai/audit");
const { assistantRouter } = await import("~/server/api/routers/assistant");
const { createCallerFactory } = await import("~/server/api/trpc");

const createCaller = createCallerFactory(assistantRouter);
const m = (fn: unknown) => fn as ReturnType<typeof vi.fn>;
const USER = { id: "user-1" } as unknown as User;
const authed = () => createCaller({ user: USER });
const anon = () => createCaller({ user: null });

const validCreate = {
  action: "create" as const,
  entity: "npc" as const,
  campaignId: "c1",
  fields: { name: "Sera" },
};

beforeEach(() => vi.clearAllMocks());

describe("assistant.commitProposal", () => {
  it("rejects an anonymous caller before any commit", async () => {
    await expect(anon().commitProposal(validCreate)).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
    expect(proposalData.commitProposal).not.toHaveBeenCalled();
  });

  it("rejects a malformed proposal with BAD_REQUEST and never commits", async () => {
    await expect(
      authed().commitProposal({
        action: "create",
        entity: "npc",
        campaignId: "c1",
        fields: {}, // missing required name
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(proposalData.commitProposal).not.toHaveBeenCalled();
  });

  it("maps a cross-user / missing campaign (not_found) to NOT_FOUND", async () => {
    m(proposalData.commitProposal).mockResolvedValue({ ok: false, reason: "not_found" });
    await expect(authed().commitProposal(validCreate)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("maps an invalid commit to BAD_REQUEST", async () => {
    m(proposalData.commitProposal).mockResolvedValue({ ok: false, reason: "invalid" });
    await expect(authed().commitProposal(validCreate)).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  });

  it("commits a valid proposal and audits the confirming user without leaking field values", async () => {
    m(proposalData.commitProposal).mockResolvedValue({ ok: true, id: "n9" });
    const result = await authed().commitProposal(validCreate);
    expect(result).toEqual({ id: "n9", action: "create", entity: "npc" });
    expect(proposalData.commitProposal).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({ action: "create", entity: "npc", campaignId: "c1" }),
    );
    // The audit record ties the commit to the user and carries no field values (redaction).
    const record = m(audit.auditProposalEvent).mock.calls.at(-1)?.[0];
    expect(record).toMatchObject({
      event: "proposal_committed",
      userId: "user-1",
      action: "create",
      entity: "npc",
      outcome: "success",
      entityId: "n9",
    });
    expect(record).not.toHaveProperty("fields");
    expect(JSON.stringify(record)).not.toContain("Sera");
  });
});
