import { z } from "zod";

import { pendingActionSchema } from "@/lib/validation/assistant-actions";

export const MAX_QUESTION_LENGTH = 2000;
export const MAX_BODY_BYTES = 32 * 1024;

// Strip control characters except tab (0x09), newline (0x0A), and carriage return (0x0D).
// Implemented as a codepoint filter to avoid embedding control characters in source.
export function stripControlChars(s: string): string {
  let out = "";
  for (const ch of s) {
    const code = ch.codePointAt(0) ?? 0;
    const isControl =
      code <= 0x08 ||
      code === 0x0b ||
      code === 0x0c ||
      (code >= 0x0e && code <= 0x1f) ||
      code === 0x7f;
    if (!isControl) out += ch;
  }
  return out;
}

// The hard cap on how many conversation messages one request may carry. The client sends only a
// bounded tail (see MAX_HISTORY_TURNS), so a longer list is a malformed or abusive request and is
// REJECTED rather than silently truncated. Individual messages are clamped, not rejected, which
// preserves the existing clamp-and-sanitize behaviour for the user's own text.
export const MAX_HISTORY_MESSAGES = 24;

// How many earlier turns the client sends and the model may see. One source for both sides, so
// the client cannot send more history than the write path is willing to consider.
export const MAX_HISTORY_TURNS = 8;

// One untrusted conversation message. Content is sanitized (control chars stripped) and clamped
// to MAX_QUESTION_LENGTH. History is only ever CONTEXT: a write intent is derived from the latest
// user message, never from an earlier turn, so a forged "assistant" turn cannot start a write.
export const assistantMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z
    .string()
    .transform((s) => stripControlChars(s).trim().slice(0, MAX_QUESTION_LENGTH)),
});

export type AssistantMessage = z.infer<typeof assistantMessageSchema>;

// Untrusted assistant input: a bounded message list ending in the user's current message, plus
// the campaign it is about. Ownership is enforced separately.
export const assistantInputSchema = z.object({
  campaignId: z.string().trim().min(1, "campaignId is required"),
  messages: z
    .array(assistantMessageSchema)
    .min(1, "a message is required")
    .max(MAX_HISTORY_MESSAGES, "too many messages")
    // Empty turns carry nothing; drop them, then require a usable latest user message.
    .transform((messages) => messages.filter((m) => m.content.length > 0))
    .refine((messages) => messages.at(-1)?.role === "user", {
      message: "the latest message must be the user's",
    }),
  // The unfinished write this message answers, echoed back from the clarification we emitted.
  // Optional: absent on a fresh request, and an unresolvable one simply falls back to
  // classification. Bounded and type-checked here; its fields are re-validated downstream.
  pending: pendingActionSchema.optional(),
});

export type AssistantInput = z.infer<typeof assistantInputSchema>;
