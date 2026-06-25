import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/ai/tiers", () => ({ getProvider: vi.fn() }));

const tiers = await import("@/lib/ai/tiers");
const { classifyEnrichmentSource } = await import("@/lib/ai/enrichment-classify");

const m = (fn: unknown) => fn as ReturnType<typeof vi.fn>;

beforeEach(() => vi.clearAllMocks());

describe("classifyEnrichmentSource", () => {
  it("returns the model's classification from text output", async () => {
    m(tiers.getProvider).mockReturnValue({
      generate: vi.fn().mockResolvedValue({
        text: "srd-likely",
        usage: { inputTokens: 1, outputTokens: 1 },
      }),
    });
    expect(await classifyEnrichmentSource("add a goblin")).toBe("srd-likely");
  });

  it("maps 'original' output", async () => {
    m(tiers.getProvider).mockReturnValue({
      generate: vi.fn().mockResolvedValue({
        text: "original",
        usage: { inputTokens: 1, outputTokens: 1 },
      }),
    });
    expect(await classifyEnrichmentSource("invent a villain")).toBe("original");
  });

  it("fails safe to 'ambiguous' on any error", async () => {
    m(tiers.getProvider).mockReturnValue({
      generate: vi.fn().mockRejectedValue(new Error("boom")),
    });
    expect(await classifyEnrichmentSource("???")).toBe("ambiguous");
  });
});
