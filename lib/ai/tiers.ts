import "server-only";

import { createAnthropic } from "@ai-sdk/anthropic";
import { createGroq } from "@ai-sdk/groq";
import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";

import { anthropicAllowsTemperature } from "@/lib/ai/adapters/anthropic";
import { createAnthropicAdapter } from "@/lib/ai/adapters/anthropic";
import { createGroqAdapter } from "@/lib/ai/adapters/groq";
import { createOpenAiAdapter } from "@/lib/ai/adapters/openai";
import type { LlmProvider } from "@/lib/ai/port";
import { Registry } from "@/lib/sdk/core/registry";
import type { SelectionConfig } from "@/lib/sdk/core/types";
import { env } from "~/env";

// Env-configurable model tiers for the assistant: cheap classify → mid answer → high
// reasoning. Selecting a tier's model is an ~/env change, not caller code.
export type ModelTier = "classify" | "answer" | "reasoning";

export function modelForTier(tier: ModelTier): string {
  switch (tier) {
    case "classify":
      return env.AI_MODEL_CLASSIFY ?? "claude-haiku-4-5";
    case "answer":
      return env.AI_MODEL_ANSWER ?? "claude-sonnet-4-6";
    case "reasoning":
      return env.AI_MODEL_REASONING ?? "claude-opus-4-8";
  }
}

function selection(): SelectionConfig {
  const active = env.AI_PROVIDER ?? "anthropic";
  const fallback = env.AI_FALLBACK
    ? env.AI_FALLBACK.split(",")
        .map((id) => id.trim())
        .filter(Boolean)
    : undefined;
  return { active, fallback };
}

// A vendor-neutral provider bound to a tier's model, via the registry (with fallback).
export function getProvider(tier: ModelTier): LlmProvider {
  const model = modelForTier(tier);
  const registry = new Registry<LlmProvider>("llm")
    .register("anthropic", createAnthropicAdapter(model))
    .register("openai", createOpenAiAdapter(model))
    .register("groq", createGroqAdapter(model));
  return registry.resolve(selection());
}

// The raw AI SDK model for a tier, plus whether temperature may be sent. Used by the
// assistant's streaming path (which needs the AI SDK's UI-message stream for useChat).
export function getLanguageModel(tier: ModelTier): {
  model: LanguageModel;
  allowTemperature: boolean;
  providerId: string;
} {
  const model = modelForTier(tier);
  const provider = env.AI_PROVIDER ?? "anthropic";
  if (provider === "groq") {
    return {
      model: createGroq({ apiKey: env.GROQ_API_KEY })(model),
      allowTemperature: true,
      providerId: "groq",
    };
  }
  if (provider === "openai") {
    return {
      model: createOpenAI({ apiKey: env.OPENAI_API_KEY })(model),
      allowTemperature: true,
      providerId: "openai",
    };
  }
  return {
    model: createAnthropic({ apiKey: env.ANTHROPIC_API_KEY })(model),
    allowTemperature: anthropicAllowsTemperature(model),
    providerId: "anthropic",
  };
}
