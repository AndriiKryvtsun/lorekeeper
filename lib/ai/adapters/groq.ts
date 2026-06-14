import "server-only";

import { createGroq } from "@ai-sdk/groq";

import { makeAiSdkAdapter } from "@/lib/ai/adapters/shared";
import type { LlmProvider } from "@/lib/ai/port";
import { env } from "~/env";

// Groq hosts open models (Llama, Qwen, etc.) behind an OpenAI-compatible API with a free
// tier — a no-cost option that, unlike a local model, is reachable from a Vercel deployment.
export function createGroqAdapter(model: string): LlmProvider {
  const groq = createGroq({ apiKey: env.GROQ_API_KEY });
  // Groq's chat models accept temperature; forward it as provided.
  return makeAiSdkAdapter("groq", groq(model), true);
}
