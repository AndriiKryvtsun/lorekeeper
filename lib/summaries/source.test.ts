import { describe, expect, it } from "vitest";

import { buildSessionContent, computeSummarySourceHash } from "@/lib/summaries/source";

const base = {
  title: "Session 1",
  date: new Date("2026-01-01T00:00:00.000Z"),
  summary: "We met the king.",
  notes: null as string | null,
};

describe("computeSummarySourceHash", () => {
  it("is stable for identical content", () => {
    expect(computeSummarySourceHash(base)).toBe(computeSummarySourceHash({ ...base }));
  });

  it("changes when any summarized field changes", () => {
    const h = computeSummarySourceHash(base);
    expect(computeSummarySourceHash({ ...base, title: "Session 2" })).not.toBe(h);
    expect(computeSummarySourceHash({ ...base, summary: "We fought a dragon." })).not.toBe(h);
    expect(computeSummarySourceHash({ ...base, notes: "extra" })).not.toBe(h);
  });
});

describe("buildSessionContent", () => {
  it("includes present fields and omits empty optional ones", () => {
    const content = buildSessionContent(base);
    expect(content).toContain("Title: Session 1");
    expect(content).toContain("Summary: We met the king.");
    expect(content).not.toContain("Notes:");
  });
});
