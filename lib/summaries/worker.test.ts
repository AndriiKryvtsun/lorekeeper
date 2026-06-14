import { beforeEach, describe, expect, it, vi } from "vitest";

import { computeSummarySourceHash } from "@/lib/summaries/source";

// Mock Prisma and the provider so the worker is tested without a DB or real generation.
const { generate } = vi.hoisted(() => ({ generate: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    sessionSummaryJob: {
      findMany: vi.fn(),
      updateMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    session: { update: vi.fn() },
    $transaction: vi.fn(async (ops: Promise<unknown>[]) => Promise.all(ops)),
  },
}));
vi.mock("@/lib/ai/tiers", () => ({
  getProvider: () => ({ generate }),
  modelForTier: () => "model-x",
}));

const { prisma } = await import("@/lib/prisma");
const { processPendingSummaries } = await import("@/lib/summaries/worker");

const p = prisma as unknown as {
  sessionSummaryJob: Record<string, ReturnType<typeof vi.fn>>;
  session: Record<string, ReturnType<typeof vi.fn>>;
};

const SESSION = {
  id: "s1",
  title: "Session 1",
  date: new Date("2026-01-01T00:00:00.000Z"),
  summary: "We met the king.",
  notes: null,
};
const HASH = computeSummarySourceHash(SESSION);

function claimOneJob(attempts = 0, aiSummarySourceHash: string | null = null) {
  p.sessionSummaryJob.findMany.mockResolvedValue([{ id: "j1" }]);
  p.sessionSummaryJob.updateMany.mockResolvedValue({ count: 1 });
  p.sessionSummaryJob.findUnique.mockResolvedValue({
    id: "j1",
    status: "processing",
    attempts,
    session: { ...SESSION, aiSummarySourceHash },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  p.sessionSummaryJob.update.mockResolvedValue({});
  p.session.update.mockResolvedValue({});
});

describe("processPendingSummaries", () => {
  it("does nothing when there are no pending jobs", async () => {
    p.sessionSummaryJob.findMany.mockResolvedValue([]);
    const r = await processPendingSummaries();
    expect(r.claimed).toBe(0);
    expect(generate).not.toHaveBeenCalled();
  });

  it("is a no-op when the content is unchanged (no provider call)", async () => {
    claimOneJob(0, HASH); // session already summarized for this exact content
    const r = await processPendingSummaries();
    expect(generate).not.toHaveBeenCalled();
    expect(p.session.update).not.toHaveBeenCalled();
    expect(p.sessionSummaryJob.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "done" }) }),
    );
    expect(r.skipped).toBe(1);
  });

  it("summarizes changed content and stores the summary + audit metadata", async () => {
    claimOneJob(0, "stale-hash");
    generate.mockResolvedValue({ text: "  The party met the king.  ", usage: {} });
    const r = await processPendingSummaries();
    expect(generate).toHaveBeenCalledTimes(1);
    expect(p.session.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "s1" },
        data: expect.objectContaining({
          aiSummary: "The party met the king.",
          aiSummaryModel: "model-x",
          aiSummarySourceHash: HASH,
        }),
      }),
    );
    expect(r.summarized).toBe(1);
  });

  it("retries on failure (increments attempts, re-queues, leaves summary intact)", async () => {
    claimOneJob(0, "stale-hash");
    generate.mockRejectedValue(new Error("provider down"));
    const r = await processPendingSummaries();
    expect(p.session.update).not.toHaveBeenCalled();
    expect(p.sessionSummaryJob.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ attempts: 1, status: "pending" }) }),
    );
    expect(r.failed).toBe(1);
  });

  it("marks the job failed once attempts are exhausted", async () => {
    claimOneJob(2, "stale-hash"); // next attempt → 3 (== MAX)
    generate.mockRejectedValue(new Error("still down"));
    await processPendingSummaries();
    expect(p.sessionSummaryJob.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ attempts: 3, status: "failed" }) }),
    );
  });
});
