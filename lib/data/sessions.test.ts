import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock ownership + an interactive Prisma transaction. The session write path must enqueue a
// summary job (provider-free) — sessions.ts imports no provider, so summarization can never be
// synchronous in the request.
const { tx } = vi.hoisted(() => ({
  tx: {
    session: { create: vi.fn(), updateMany: vi.fn(), findUnique: vi.fn() },
    sessionSummaryJob: { upsert: vi.fn() },
  },
}));
vi.mock("@/lib/data/owned", () => ({ isOwnedCampaign: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: { $transaction: vi.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)) },
}));

const owned = await import("@/lib/data/owned");
const { createSessionForOwner, updateSessionForOwner } = await import("./sessions");

const isOwned = owned.isOwnedCampaign as unknown as ReturnType<typeof vi.fn>;
const SESSION = {
  id: "s1",
  title: "Session 1",
  date: new Date("2026-01-01T00:00:00.000Z"),
  summary: null,
  notes: null,
  campaignId: "c1",
};

beforeEach(() => {
  vi.clearAllMocks();
  tx.sessionSummaryJob.upsert.mockResolvedValue({});
});

describe("createSessionForOwner enqueues a summary job", () => {
  it("creates the session and upserts a pending job (one per session)", async () => {
    isOwned.mockResolvedValue(true);
    tx.session.create.mockResolvedValue(SESSION);
    const result = await createSessionForOwner("user-1", "c1", {
      title: "Session 1",
      date: SESSION.date,
    });
    expect(result).toEqual(SESSION);
    expect(tx.sessionSummaryJob.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { sessionId: "s1" },
        create: expect.objectContaining({ sessionId: "s1", status: "pending" }),
      }),
    );
  });

  it("does not create or enqueue for an unowned campaign", async () => {
    isOwned.mockResolvedValue(false);
    const result = await createSessionForOwner("user-1", "c1", {
      title: "X",
      date: SESSION.date,
    });
    expect(result).toBeNull();
    expect(tx.session.create).not.toHaveBeenCalled();
    expect(tx.sessionSummaryJob.upsert).not.toHaveBeenCalled();
  });
});

describe("updateSessionForOwner re-enqueues", () => {
  it("re-enqueues after a successful owner-scoped update", async () => {
    tx.session.updateMany.mockResolvedValue({ count: 1 });
    tx.session.findUnique.mockResolvedValue(SESSION);
    const result = await updateSessionForOwner("user-1", "s1", { title: "New" });
    expect(result).toEqual(SESSION);
    expect(tx.sessionSummaryJob.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { sessionId: "s1" } }),
    );
  });

  it("does not enqueue when the update matched nothing (cross-user)", async () => {
    tx.session.updateMany.mockResolvedValue({ count: 0 });
    const result = await updateSessionForOwner("user-1", "s1", { title: "New" });
    expect(result).toBeNull();
    expect(tx.sessionSummaryJob.upsert).not.toHaveBeenCalled();
  });
});
