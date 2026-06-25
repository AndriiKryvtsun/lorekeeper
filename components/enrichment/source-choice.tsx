"use client";

import { BookOpen, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { EnrichMatchPicker } from "@/components/enrichment/match-picker";
import type { EnrichProvenance } from "@/components/enrichment/enrich-controls";
import { EntityDraftReview } from "@/components/enrichment/entity-draft-review";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/use-toast";
import { api } from "~/trpc/react";

// Source picker shown inline in chat for a create intent. When the recommendation is
// unambiguous it auto-runs that source; when ambiguous it shows two buttons. Both paths produce
// an editable review and NEVER auto-write. SRD is offered for NPCs only.
type Recommended = "srd-likely" | "original" | "ambiguous";
type Fields = Record<string, unknown>;
type Review = { fields: Fields; provenance: EnrichProvenance };

// The chat message is a sentence ("add a goblin"); the SRD lookup wants the creature NAME.
// Strip common request filler so the default search term is the entity, not the prose. If
// nothing meaningful remains (e.g. "create a new npc for my campaign"), return "" so the SRD
// action stays disabled until the user types a name.
const SRD_STOPWORDS = new Set([
  "add", "create", "make", "new", "a", "an", "the", "some", "another",
  "npc", "character", "monster", "creature", "enemy", "for", "my", "our",
  "this", "that", "to", "please", "named", "name", "called", "in", "of",
  "campaign", "game", "session",
]);

function deriveSrdTerm(message: string): string {
  return message
    .toLowerCase()
    .replace(/[^a-z0-9\s'-]/g, " ")
    .split(/\s+/)
    .filter((w) => w && !SRD_STOPWORDS.has(w))
    .join(" ")
    .trim();
}

export function SourceChoice({
  kind,
  campaignId,
  query,
  recommended,
}: {
  kind: "npc" | "character";
  campaignId: string;
  query: string;
  recommended: Recommended;
}) {
  const srdAvailable = kind === "npc";
  // Seed the SRD search with the creature name extracted from the message, not the whole prose.
  const [term, setTerm] = useState(() => deriveSrdTerm(query));
  const [matches, setMatches] = useState<{ label: string; review: Review }[] | null>(null);
  const [review, setReview] = useState<Review | null>(null);
  const [done, setDone] = useState(false);
  const ranRef = useRef(false);

  const srd = api.enrichment.proposeFromSrd.useMutation({
    onSuccess: (res) => {
      if (res.candidates.length === 0) {
        toast({ title: "No SRD match", description: "Generate one or add it manually." });
        return;
      }
      if (res.candidates.length === 1) {
        const c = res.candidates[0]!;
        setReview({
          fields: c.proposal.fields,
          provenance: { source: "srd", attribution: c.proposal.attribution },
        });
        return;
      }
      setMatches(
        res.candidates.map((c) => ({
          label: c.label,
          review: {
            fields: c.proposal.fields,
            provenance: { source: "srd", attribution: c.proposal.attribution },
          },
        })),
      );
    },
    onError: () => toast({ title: "SRD lookup failed", variant: "destructive" }),
  });

  const agent = api.enrichment.proposeFromAgent.useMutation({
    onSuccess: (res) =>
      setReview({ fields: res.proposal.fields, provenance: { source: "agent" } }),
    onError: () => toast({ title: "Generation failed", variant: "destructive" }),
  });

  const runSrd = () => {
    setMatches(null);
    srd.mutate({ kind, campaignId, query: term.trim() });
  };
  const runAgent = () => {
    setMatches(null);
    agent.mutate({ kind, campaignId, prompt: query });
  };

  // Default sensibly: auto-run the recommended source once. Only auto-search the SRD when we
  // actually have a creature name; otherwise show the panel so the user can type one. Ambiguous
  // always waits for the user.
  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;
    if (recommended === "srd-likely" && srdAvailable && term.trim()) runSrd();
    else if (recommended === "original" || !srdAvailable) runAgent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (done) return null;

  if (review) {
    return (
      <EntityDraftReview
        kind={kind}
        campaignId={campaignId}
        draft={review.fields}
        provenance={review.provenance}
        onClose={() => setDone(true)}
      />
    );
  }

  return (
    <div className="mt-3 space-y-2 rounded-md border border-border p-3">
      <p className="text-sm font-medium">
        Add a {kind === "npc" ? "NPC" : "character"}
      </p>
      {srdAvailable ? (
        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground" htmlFor="srd-term">
            SRD search
          </label>
          <Input id="srd-term" value={term} onChange={(e) => setTerm(e.target.value)} />
        </div>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {srdAvailable ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={srd.isPending || !term.trim()}
            onClick={runSrd}
          >
            <BookOpen aria-hidden="true" />
            {srd.isPending ? "Searching…" : "From SRD"}
          </Button>
        ) : null}
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={agent.isPending}
          onClick={runAgent}
        >
          <Sparkles aria-hidden="true" />
          {agent.isPending ? "Generating…" : "Generate"}
        </Button>
      </div>
      {matches ? (
        <EnrichMatchPicker
          matches={matches.map((m) => m.label)}
          onPick={(i) => setReview(matches[i]!.review)}
          onCancel={() => setMatches(null)}
        />
      ) : null}
    </div>
  );
}
