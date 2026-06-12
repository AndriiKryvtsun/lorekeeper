import "server-only";

import { llm } from "@/lib/ai";
import { evalCases } from "@/lib/ai/eval/prompts";

// Runs the eval set through the ACTIVE provider via the port. Manual use when switching
// providers/models (needs real API keys + network) — not part of the unit suite. Invoke
// with e.g. `tsx lib/ai/eval/run.ts`.
export async function runEvals(): Promise<void> {
  const provider = llm();
  for (const c of evalCases) {
    try {
      if (c.kind === "object" && c.schema) {
        const { object, usage } = await provider.generateObject({
          system: c.system,
          messages: c.messages,
          schema: c.schema,
        });
        console.info(
          `[eval:${c.name}] object=${JSON.stringify(object)} tokens=${usage.inputTokens}/${usage.outputTokens}`,
        );
      } else {
        const { text, usage } = await provider.generate({
          system: c.system,
          messages: c.messages,
        });
        console.info(
          `[eval:${c.name}] text=${JSON.stringify(text)} tokens=${usage.inputTokens}/${usage.outputTokens}`,
        );
      }
    } catch (error) {
      console.error(
        `[eval:${c.name}] failed: ${error instanceof Error ? error.name : "Error"}`,
      );
    }
  }
}
