import "server-only";

import type { ZodType } from "zod";

// Vendor-neutral LLM port. No vendor/AI-SDK type appears here — application code depends on
// this interface, and only the adapter files under lib/ai/adapters import a vendor SDK.

export type LlmRole = "system" | "user" | "assistant";
export type LlmMessage = { role: LlmRole; content: string };
export type LlmUsage = { inputTokens: number; outputTokens: number };

export type LlmCallOptions = {
  messages: LlmMessage[];
  system?: string;
  maxOutputTokens?: number;
  temperature?: number;
  signal?: AbortSignal;
};

export type LlmGenerateResult = { text: string; usage: LlmUsage };
export type LlmStreamResult = {
  // Text chunks as they arrive; `usage` resolves once the stream has drained.
  textStream: AsyncIterable<string>;
  usage: Promise<LlmUsage>;
};
export type LlmObjectResult<T> = { object: T; usage: LlmUsage };

export interface LlmProvider {
  generate(opts: LlmCallOptions): Promise<LlmGenerateResult>;
  stream(opts: LlmCallOptions): Promise<LlmStreamResult>;
  generateObject<T>(
    opts: LlmCallOptions & { schema: ZodType<T> },
  ): Promise<LlmObjectResult<T>>;
}
