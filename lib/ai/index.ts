import "server-only";

import { createAnthropicAdapter } from "@/lib/ai/adapters/anthropic";
import { createGroqAdapter } from "@/lib/ai/adapters/groq";
import { createOpenAiAdapter } from "@/lib/ai/adapters/openai";
import type { LlmProvider } from "@/lib/ai/port";
import { Registry } from "@/lib/sdk/core/registry";
import type { SelectionConfig } from "@/lib/sdk/core/types";
import { env } from "~/env";

// Both adapters are bound to AI_MODEL. AI_MODEL must be valid for the active AI_PROVIDER;
// cross-provider fallback also requires a model the fallback provider supports (an
// operational concern — selecting/switching is an env change, never caller code).
const registry = new Registry<LlmProvider>("llm")
  .register("anthropic", createAnthropicAdapter(env.AI_MODEL ?? "claude-opus-4-8"))
  .register("openai", createOpenAiAdapter(env.AI_MODEL ?? "claude-opus-4-8"))
  .register("groq", createGroqAdapter(env.AI_MODEL ?? "claude-opus-4-8"));

function selection(): SelectionConfig {
  const active = env.AI_PROVIDER ?? "anthropic";
  const fallback = env.AI_FALLBACK
    ? env.AI_FALLBACK.split(",")
        .map((id) => id.trim())
        .filter(Boolean)
    : undefined;
  return { active, fallback };
}

// The active LLM provider, selected from ~/env.
export function llm(): LlmProvider {
  return registry.resolve(selection());
}

// Run an LLM operation against the active provider, falling back to the next on failure.
export function withLlmFallback<R>(
  fn: (provider: LlmProvider, id: string) => Promise<R>,
): Promise<R> {
  return registry.callWithFallback(selection(), fn);
}
