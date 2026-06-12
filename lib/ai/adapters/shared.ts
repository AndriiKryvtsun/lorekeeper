import "server-only";

import {
  APICallError,
  generateObject,
  generateText,
  streamText,
  type LanguageModel,
  type ModelMessage,
} from "ai";
import type { ZodType } from "zod";

import type {
  LlmCallOptions,
  LlmObjectResult,
  LlmProvider,
  LlmUsage,
} from "@/lib/ai/port";
import {
  RateLimitError,
  TimeoutError,
  UpstreamError,
} from "@/lib/sdk/core/errors";
import { recordTelemetry } from "@/lib/sdk/core/telemetry";

const CAPABILITY = "llm";

// Vendor-neutral messages → AI SDK ModelMessage. Content is always a string here, valid for
// every role; the per-element assertion narrows the broad LlmMessage to the SDK's union.
function toModelMessages(messages: LlmCallOptions["messages"]): ModelMessage[] {
  return messages.map((m) => ({ role: m.role, content: m.content }) as ModelMessage);
}

function mapUsage(
  u: { inputTokens?: number; outputTokens?: number } | undefined,
): LlmUsage {
  return { inputTokens: u?.inputTokens ?? 0, outputTokens: u?.outputTokens ?? 0 };
}

// Map AI SDK errors to the SDK's typed error hierarchy. Never includes prompt/response text.
export function mapLlmError(error: unknown, providerId: string): never {
  if (
    error instanceof Error &&
    (error.name === "AbortError" || error.name === "TimeoutError")
  ) {
    throw new TimeoutError("LLM call timed out or was aborted", {
      capability: CAPABILITY,
      providerId,
    });
  }
  if (APICallError.isInstance(error)) {
    if (error.statusCode === 429) {
      throw new RateLimitError("LLM provider rate limited", {
        capability: CAPABILITY,
        providerId,
      });
    }
    throw new UpstreamError("LLM provider error", {
      capability: CAPABILITY,
      providerId,
      status: error.statusCode,
    });
  }
  throw new UpstreamError("LLM call failed", {
    capability: CAPABILITY,
    providerId,
  });
}

function record(
  providerId: string,
  outcome: "success" | "error",
  start: number,
  errorType?: string,
): void {
  recordTelemetry({
    capability: CAPABILITY,
    providerId,
    outcome,
    latencyMs: Date.now() - start,
    errorType,
  });
}

// Builds an LlmProvider that wraps the Vercel AI SDK. `allowTemperature` is false for models
// that reject sampling params (Anthropic Opus 4.7/4.8, Fable) — temperature is dropped there.
export function makeAiSdkAdapter(
  providerId: string,
  model: LanguageModel,
  allowTemperature: boolean,
): LlmProvider {
  const temperatureOf = (o: LlmCallOptions) =>
    allowTemperature ? o.temperature : undefined;

  return {
    async generate(o) {
      const start = Date.now();
      try {
        const r = await generateText({
          model,
          system: o.system,
          messages: toModelMessages(o.messages),
          maxOutputTokens: o.maxOutputTokens,
          temperature: temperatureOf(o),
          abortSignal: o.signal,
        });
        record(providerId, "success", start);
        return { text: r.text, usage: mapUsage(r.usage) };
      } catch (error) {
        record(providerId, "error", start, error instanceof Error ? error.name : "Error");
        mapLlmError(error, providerId);
      }
    },

    async stream(o) {
      const start = Date.now();
      const r = streamText({
        model,
        system: o.system,
        messages: toModelMessages(o.messages),
        maxOutputTokens: o.maxOutputTokens,
        temperature: temperatureOf(o),
        abortSignal: o.signal,
      });
      const usage = Promise.resolve(r.usage).then(
        (u) => {
          record(providerId, "success", start);
          return mapUsage(u);
        },
        (error) => {
          record(providerId, "error", start, error instanceof Error ? error.name : "Error");
          return mapLlmError(error, providerId);
        },
      );
      return { textStream: r.textStream, usage };
    },

    async generateObject<T>(
      o: LlmCallOptions & { schema: ZodType<T> },
    ): Promise<LlmObjectResult<T>> {
      const start = Date.now();
      try {
        const r = await generateObject({
          model,
          system: o.system,
          messages: toModelMessages(o.messages),
          maxOutputTokens: o.maxOutputTokens,
          temperature: temperatureOf(o),
          abortSignal: o.signal,
          schema: o.schema,
        });
        record(providerId, "success", start);
        return { object: r.object, usage: mapUsage(r.usage) };
      } catch (error) {
        record(providerId, "error", start, error instanceof Error ? error.name : "Error");
        mapLlmError(error, providerId);
      }
    },
  };
}
