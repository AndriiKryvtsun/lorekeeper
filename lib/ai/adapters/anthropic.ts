import "server-only";

import { createAnthropic } from "@ai-sdk/anthropic";

import { makeAiSdkAdapter } from "@/lib/ai/adapters/shared";
import type { LlmProvider } from "@/lib/ai/port";
import { env } from "~/env";

// Anthropic reasoning models (Opus 4.7/4.8, Fable) reject sampling params (temperature →
// 400). For those, the adapter drops temperature; older models still accept it.
export function anthropicAllowsTemperature(model: string): boolean {
  return !/^claude-(opus-4-(7|8)|fable)/.test(model);
}

export function createAnthropicAdapter(model: string): LlmProvider {
  const anthropic = createAnthropic({ apiKey: env.ANTHROPIC_API_KEY });
  return makeAiSdkAdapter("anthropic", anthropic(model), anthropicAllowsTemperature(model));
}
