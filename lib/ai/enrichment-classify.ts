import "server-only";

import { getProvider } from "@/lib/ai/tiers";

// Classify the SOURCE intent of a create request, using the cheap `classify` tier and ONLY the
// user's own message (prompt-injection safe — no campaign data is consulted). Uses plain text
// generation (not generateObject) so it works across every provider, including those whose
// models don't support a JSON-schema response format.
export type EnrichmentSource = "srd-likely" | "original" | "ambiguous";

const SYSTEM =
  "You classify a user's request to add a tabletop-RPG entity. Decide if they want a creature " +
  "that exists in the standard open SRD (\"srd-likely\", e.g. a goblin, an owlbear), an original " +
  "invented entity (\"original\", e.g. a uniquely named character or homebrew), or it is unclear " +
  '("ambiguous"). Respond with EXACTLY one of: srd-likely, original, ambiguous. No other text.';

export async function classifyEnrichmentSource(
  message: string,
): Promise<EnrichmentSource> {
  try {
    const { text } = await getProvider("classify").generate({
      system: SYSTEM,
      messages: [{ role: "user", content: message }],
      maxOutputTokens: 16,
      temperature: 0,
    });
    const t = text.toLowerCase();
    if (t.includes("srd")) return "srd-likely";
    if (t.includes("original")) return "original";
    return "ambiguous";
  } catch {
    // Fail safe: when unsure, ask the user rather than guessing a source.
    return "ambiguous";
  }
}
