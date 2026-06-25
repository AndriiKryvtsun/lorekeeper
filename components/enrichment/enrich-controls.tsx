"use client";

import { BookOpen, Sparkles } from "lucide-react";
import { useState } from "react";

import { EnrichMatchPicker } from "@/components/enrichment/match-picker";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";
import { api } from "~/trpc/react";

export type EnrichProvenance = { source: "srd" | "agent"; attribution?: string };
type Fields = Record<string, unknown>;
type Match = { label: string; fields: Fields; attribution?: string };

// Secondary enrichment affordance shown next to the name field in the entity form. Manual entry
// stays primary; these actions only FILL the form (nothing is written until the user saves).
// SRD is offered for NPCs; agent generation for both. Multiple SRD matches surface a picker;
// no match falls back quietly to manual entry.
export function EnrichControls({
  kind,
  campaignId,
  offerSrd,
  name,
  onFill,
}: {
  kind: "npc" | "character";
  campaignId: string;
  offerSrd: boolean;
  name: string;
  onFill: (fields: Fields, provenance: EnrichProvenance) => void;
}) {
  const [matches, setMatches] = useState<Match[] | null>(null);
  const disabled = name.trim().length === 0;

  const srd = api.enrichment.proposeFromSrd.useMutation({
    onSuccess: (res) => {
      if (res.candidates.length === 0) {
        toast({ title: "No SRD match", description: "Fill in the details manually." });
        return;
      }
      if (res.candidates.length === 1) {
        const c = res.candidates[0]!;
        onFill(c.proposal.fields, { source: "srd", attribution: c.proposal.attribution });
        return;
      }
      setMatches(
        res.candidates.map((c) => ({
          label: c.label,
          fields: c.proposal.fields,
          attribution: c.proposal.attribution,
        })),
      );
    },
    onError: () => toast({ title: "SRD lookup failed", variant: "destructive" }),
  });

  const agent = api.enrichment.proposeFromAgent.useMutation({
    onSuccess: (res) => onFill(res.proposal.fields, { source: "agent" }),
    onError: () => toast({ title: "Generation failed", variant: "destructive" }),
  });

  return (
    <div className="space-y-2 rounded-md border border-dashed border-border p-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground">Enrich:</span>
        {offerSrd ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={disabled || srd.isPending}
            onClick={() => {
              setMatches(null);
              srd.mutate({ kind, campaignId, query: name.trim() });
            }}
          >
            <BookOpen aria-hidden="true" />
            {srd.isPending ? "Searching…" : "From SRD"}
          </Button>
        ) : null}
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={disabled || agent.isPending}
          onClick={() => {
            setMatches(null);
            agent.mutate({ kind, campaignId, prompt: name.trim() });
          }}
        >
          <Sparkles aria-hidden="true" />
          {agent.isPending ? "Generating…" : "Generate"}
        </Button>
      </div>
      {matches ? (
        <EnrichMatchPicker
          matches={matches.map((m) => m.label)}
          onPick={(i) => {
            const m = matches[i]!;
            onFill(m.fields, { source: "srd", attribution: m.attribution });
            setMatches(null);
          }}
          onCancel={() => setMatches(null)}
        />
      ) : null}
      <p className="text-xs text-muted-foreground">
        Type a name first.{" "}
        {offerSrd ? "“From SRD” looks up an official creature; " : null}
        “Generate” drafts an original. It fills the form — nothing is saved until you submit.
      </p>
    </div>
  );
}
