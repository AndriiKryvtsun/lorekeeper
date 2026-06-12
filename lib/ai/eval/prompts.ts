import "server-only";

import { z } from "zod";

import type { LlmMessage } from "@/lib/ai/port";

// Small, vendor-neutral eval set to re-check behavior when switching providers/models.
// Defined in terms of the port only — no vendor specifics.

export type EvalCase = {
  name: string;
  kind: "generate" | "object";
  system?: string;
  messages: LlmMessage[];
  // For "object" cases: the schema the output must satisfy.
  schema?: z.ZodType<unknown>;
};

export const evalCases: EvalCase[] = [
  {
    name: "factual-qa",
    kind: "generate",
    messages: [{ role: "user", content: "What is the capital of France? Answer in one word." }],
  },
  {
    name: "format-following",
    kind: "generate",
    system: "Respond with exactly three comma-separated lowercase words, nothing else.",
    messages: [{ role: "user", content: "List three primary colors." }],
  },
  {
    name: "structured-output",
    kind: "object",
    messages: [
      {
        role: "user",
        content: "Extract the name and age: 'Mara is 34 years old.'",
      },
    ],
    schema: z.object({ name: z.string(), age: z.number().int() }),
  },
];
