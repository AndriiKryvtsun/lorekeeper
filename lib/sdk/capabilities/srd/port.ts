import type { CreateNpcInput } from "@/lib/validation/npc";

// The single typed PORT for the SRD lookup capability. One interface per capability — not
// widened to unrelated APIs. SRD content (Open5e / dnd5eapi) exposes monsters/creatures, which
// map onto NPCs; player Characters are not part of the open SRD (the agent source covers them).

// A mapped, schema-shaped SRD result ready to become a proposal. `data` is validated against
// the SAME create schema the NPC mutation uses, so a candidate is committable by construction.
export type SrdCandidate = {
  source: "srd";
  // OGL/CC attribution notice to persist alongside the entity (license compliance).
  attribution: string;
  // Display label for the multiple-match picker.
  label: string;
  data: CreateNpcInput;
};

export interface SrdPort {
  // Look up SRD monsters by name. Returns zero (no match), one (exact), or many (pick-list)
  // candidates. No match is a normal empty result, never an error.
  lookup(query: string): Promise<SrdCandidate[]>;
}
