import { describe, expect, it } from "vitest";

import {
  MAX_QUESTION_LENGTH,
  assistantInputSchema,
  stripControlChars,
} from "@/lib/validation/assistant";

describe("stripControlChars", () => {
  it("removes control characters but keeps tab/newline", () => {
    const nul = String.fromCharCode(0);
    const del = String.fromCharCode(0x7f);
    const input = `a${nul}b${del}c\td\ne`;
    expect(stripControlChars(input)).toBe("abc\td\ne");
  });
});

describe("assistantInputSchema", () => {
  it("accepts valid input", () => {
    const parsed = assistantInputSchema.parse({
      campaignId: "c1",
      question: "What is the plot?",
    });
    expect(parsed).toEqual({ campaignId: "c1", question: "What is the plot?" });
  });

  it("clamps an over-long question to the max length", () => {
    const long = "x".repeat(MAX_QUESTION_LENGTH + 500);
    const parsed = assistantInputSchema.parse({ campaignId: "c1", question: long });
    expect(parsed.question.length).toBe(MAX_QUESTION_LENGTH);
  });

  it("rejects an empty/whitespace question", () => {
    expect(
      assistantInputSchema.safeParse({ campaignId: "c1", question: "   " }).success,
    ).toBe(false);
  });

  it("rejects a missing campaignId", () => {
    expect(
      assistantInputSchema.safeParse({ campaignId: "", question: "hi" }).success,
    ).toBe(false);
  });
});
