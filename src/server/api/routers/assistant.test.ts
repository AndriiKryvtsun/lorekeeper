import type { User } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock the commit (data layer) and the audit sink. The router under test must enforce
// confirm-before-write: it resolves the registry entry, re-validates the payload, delegates to
// commitProposal, audits the outcome, and returns ONE envelope for every case.
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

const lastAudit = () => m(audit.auditProposalEvent).mock.calls.at(-1)?.[0];

beforeEach(() => vi.clearAllMocks());

describe("assistant.commitProposal", () => {
  it("rejects an anonymous caller before any commit", async () => {
    await expect(anon().commitProposal(validCreate)).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
    expect(proposalData.commitProposal).not.toHaveBeenCalled();
  });

  it("commits a valid proposal and returns a success envelope", async () => {
    m(proposalData.commitProposal).mockResolvedValue({ ok: true, id: "n9" });
    const result = await authed().commitProposal(validCreate);
    expect(result).toEqual({
      outcome: "success",
      action: "create",
      entity: "npc",
      entityId: "n9",
      title: "Sera",
    });
    expect(proposalData.commitProposal).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({ action: "create", entity: "npc", campaignId: "c1" }),
    );
  });

  it("audits the confirming user and the registry scope without leaking field values", async () => {
    m(proposalData.commitProposal).mockResolvedValue({ ok: true, id: "n9" });
    await authed().commitProposal(validCreate);
    const record = lastAudit();
    expect(record).toMatchObject({
      event: "proposal_committed",
      userId: "user-1",
      action: "create",
      entity: "npc",
      scope: "campaign:npc:write",
      outcome: "success",
      entityId: "n9",
    });
    expect(record).not.toHaveProperty("fields");
    expect(JSON.stringify(record)).not.toContain("Sera");
  });
});

describe("the registry decides what may be committed", () => {
  // The commit input's enums narrow action and entity to the registry's vocabulary, and the
  // shipped registry binds all 15 pairs — so the router's unsupported_action branch is reachable
  // only if a pair is ever removed from the registry. That resolution is covered directly by
  // resolveActionKey's tests; here we pin the boundary behaviour a caller can actually reach.
  it("rejects an out-of-vocabulary action or entity at the input boundary", async () => {
    await expect(
      authed().commitProposal({
        ...validCreate,
        action: "archive" as unknown as "create",
      }),
    ).rejects.toBeDefined();
    await expect(
      authed().commitProposal({
        ...validCreate,
        entity: "spaceship" as unknown as "npc",
      }),
    ).rejects.toBeDefined();
    expect(proposalData.commitProposal).not.toHaveBeenCalled();
  });
});

describe("re-validation at commit", () => {
  it("returns invalid_payload for a payload that no longer satisfies the schema, and never commits", async () => {
    const result = await authed().commitProposal({
      action: "create",
      entity: "npc",
      campaignId: "c1",
      fields: {}, // the required name was removed after the proposal was shown
    });
    expect(result).toMatchObject({
      outcome: "validation_error",
      code: "invalid_payload",
    });
    expect(proposalData.commitProposal).not.toHaveBeenCalled();
    expect(lastAudit()).toMatchObject({ outcome: "error", reason: "invalid_payload" });
  });

  it("returns invalid_payload when an update carries no target", async () => {
    const result = await authed().commitProposal({
      action: "update",
      entity: "npc",
      campaignId: "c1",
      fields: { name: "Sera" },
    });
    expect(result).toMatchObject({ outcome: "validation_error" });
    expect(proposalData.commitProposal).not.toHaveBeenCalled();
  });

  it("strips over-scoped keys rather than committing them", async () => {
    m(proposalData.commitProposal).mockResolvedValue({ ok: true, id: "n9" });
    await authed().commitProposal({
      ...validCreate,
      fields: { name: "Sera", campaignId: "someone-elses", id: "forced" },
    });
    const committed = m(proposalData.commitProposal).mock.calls[0]![1] as {
      campaignId: string;
      fields: Record<string, unknown>;
    };
    expect(committed.campaignId).toBe("c1");
    expect(Object.keys(committed.fields).sort()).toEqual(["name", "status"]);
  });
});

describe("failures are normalised into the envelope", () => {
  it("maps a cross-user or missing campaign to one indistinguishable not_found", async () => {
    m(proposalData.commitProposal).mockResolvedValue({ ok: false, reason: "not_found" });
    const unowned = await authed().commitProposal(validCreate);

    m(proposalData.commitProposal).mockResolvedValue({ ok: false, reason: "not_found" });
    const missing = await authed().commitProposal({
      ...validCreate,
      campaignId: "does-not-exist",
    });

    expect(unowned).toMatchObject({ outcome: "operation_error", code: "not_found" });
    expect(missing).toEqual(unowned);
    // Nothing reveals that the resource exists.
    expect(JSON.stringify(unowned)).not.toContain("owner");
  });

  it("maps an invalid commit to invalid_operation", async () => {
    m(proposalData.commitProposal).mockResolvedValue({ ok: false, reason: "invalid" });
    const result = await authed().commitProposal(validCreate);
    expect(result).toMatchObject({
      outcome: "operation_error",
      code: "invalid_operation",
    });
  });

  it("normalises an unexpected data-layer failure to a transport error, leaking nothing", async () => {
    m(proposalData.commitProposal).mockRejectedValue(
      new Error("connect ECONNREFUSED 10.0.0.5:5432 password=hunter2"),
    );
    const result = await authed().commitProposal(validCreate);
    expect(result).toMatchObject({ outcome: "transport_error", code: "unavailable" });
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain("ECONNREFUSED");
    expect(serialized).not.toContain("hunter2");
    expect(serialized).not.toContain("10.0.0.5");
  });

  it("keeps the three failure modes distinguishable by outcome and code", async () => {
    const codes: string[] = [];

    const invalidPayload = await authed().commitProposal({ ...validCreate, fields: {} });
    codes.push(`${invalidPayload.outcome}/${"code" in invalidPayload ? invalidPayload.code : ""}`);

    m(proposalData.commitProposal).mockResolvedValue({ ok: false, reason: "not_found" });
    const refused = await authed().commitProposal(validCreate);
    codes.push(`${refused.outcome}/${"code" in refused ? refused.code : ""}`);

    m(proposalData.commitProposal).mockRejectedValue(new Error("boom"));
    const broken = await authed().commitProposal(validCreate);
    codes.push(`${broken.outcome}/${"code" in broken ? broken.code : ""}`);

    expect(new Set(codes).size).toBe(3);
    expect(codes).toEqual([
      "validation_error/invalid_payload",
      "operation_error/not_found",
      "transport_error/unavailable",
    ]);
  });
});
