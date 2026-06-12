import { describe, expect, it, vi } from "vitest";
import type { ZodType } from "zod";
import { z } from "zod";

import type { LlmCallOptions, LlmProvider } from "@/lib/ai/port";
import {
  NoProviderConfiguredError,
  UnknownProviderError,
} from "@/lib/sdk/core/errors";
import { Registry } from "@/lib/sdk/core/registry";

// A fake provider implementing the port — no network. generateObject validates against the
// supplied schema (the capability's contract: conforming object returned, else rejected).
function makeFake(id: string, raw: unknown = { name: "Mara", age: 34 }): LlmProvider {
  return {
    async generate() {
      return { text: `hello from ${id}`, usage: { inputTokens: 1, outputTokens: 1 } };
    },
    async stream() {
      async function* gen() {
        yield "chunk";
      }
      return { textStream: gen(), usage: Promise.resolve({ inputTokens: 1, outputTokens: 1 }) };
    },
    async generateObject<T>(opts: LlmCallOptions & { schema: ZodType<T> }) {
      return { object: opts.schema.parse(raw), usage: { inputTokens: 1, outputTokens: 1 } };
    },
  };
}

function buildRegistry() {
  return new Registry<LlmProvider>("llm")
    .register("anthropic", makeFake("anthropic"))
    .register("openai", makeFake("openai"));
}

describe("LLM provider selection", () => {
  it("resolves the active provider from selection config", async () => {
    const provider = buildRegistry().resolve({ active: "openai" });
    expect((await provider.generate({ messages: [] })).text).toBe("hello from openai");
  });

  it("falls back to the next provider when the primary fails", async () => {
    const reg = new Registry<LlmProvider>("llm")
      .register("primary", {
        ...makeFake("primary"),
        generate: vi.fn(async () => {
          throw new Error("primary down");
        }),
      })
      .register("secondary", makeFake("secondary"));

    const result = await reg.callWithFallback(
      { active: "primary", fallback: ["secondary"] },
      (p) => p.generate({ messages: [] }),
    );
    expect(result.text).toBe("hello from secondary");
  });

  it("throws UnknownProviderError for an unregistered provider", () => {
    expect(() => buildRegistry().resolve({ active: "gemini" })).toThrow(
      UnknownProviderError,
    );
  });

  it("throws NoProviderConfiguredError when no active provider", () => {
    expect(() =>
      buildRegistry().resolve({ active: "" } as unknown as { active: string }),
    ).toThrow(NoProviderConfiguredError);
  });
});

describe("generateObject contract", () => {
  const schema = z.object({ name: z.string(), age: z.number().int() });

  it("returns a conforming object", async () => {
    const provider = makeFake("anthropic", { name: "Mara", age: 34 });
    const { object } = await provider.generateObject({ messages: [], schema });
    expect(object).toEqual({ name: "Mara", age: 34 });
  });

  it("rejects output that does not conform to the schema", async () => {
    const provider = makeFake("anthropic", { name: "Mara", age: "thirty" });
    await expect(
      provider.generateObject({ messages: [], schema }),
    ).rejects.toBeTruthy();
  });
});
