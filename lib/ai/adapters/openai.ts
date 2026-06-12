import "server-only";

import { createOpenAI } from "@ai-sdk/openai";

import { makeAiSdkAdapter } from "@/lib/ai/adapters/shared";
import type { LlmProvider } from "@/lib/ai/port";
import { env } from "~/env";

export function createOpenAiAdapter(model: string): LlmProvider {
  const openai = createOpenAI({ apiKey: env.OPENAI_API_KEY });
  // OpenAI models accept temperature; forward it as provided.
  return makeAiSdkAdapter("openai", openai(model), true);
}
