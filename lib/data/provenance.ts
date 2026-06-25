// Optional provenance for enriched entities (NPC/Character). `source` records where the entity
// came from ("srd" | "agent"); `attribution` holds the OGL/CC notice for SRD-sourced entities.
// Manual entry passes nothing → both columns stay null.
export type EntityProvenance = {
  source?: string | null;
  attribution?: string | null;
};

// Normalize to the column shape, defaulting to nulls so a plain create clears provenance.
export function toProvenance(p?: EntityProvenance): {
  source: string | null;
  attribution: string | null;
} {
  return { source: p?.source ?? null, attribution: p?.attribution ?? null };
}
