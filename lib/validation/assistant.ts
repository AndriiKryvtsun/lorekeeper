import { z } from "zod";

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

// Untrusted assistant input. The question is sanitized (control chars stripped) and clamped
// to MAX_QUESTION_LENGTH; campaignId is validated. Ownership is enforced separately.
export const assistantInputSchema = z.object({
  campaignId: z.string().trim().min(1, "campaignId is required"),
  question: z
    .string()
    .transform((s) => stripControlChars(s).trim().slice(0, MAX_QUESTION_LENGTH))
    .pipe(z.string().min(1, "question is required")),
});

export type AssistantInput = z.infer<typeof assistantInputSchema>;
