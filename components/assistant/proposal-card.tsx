"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import {
  parseProposal,
  proposalTitle,
  type Proposal,
} from "@/lib/validation/assistant-proposal";
import { api } from "~/trpc/react";

// Renders an assistant write-proposal as a confirmable card. NOTHING is written until the
// user clicks Confirm, which calls the server-side commit mutation; Cancel discards it. The
// `raw` value is the untrusted `data-proposal` stream part, validated here before display.
export function ProposalCard({ raw }: { raw: unknown }) {
  const proposal = parseProposal(raw);
  const [state, setState] = useState<"pending" | "done" | "cancelled">("pending");
  const utils = api.useUtils();
  const commit = api.assistant.commitProposal.useMutation({
    onSuccess: async (_data, variables) => {
      setState("done");
      await invalidateFor(utils, variables.entity, variables.campaignId);
    },
  });

  // A malformed proposal part is ignored rather than rendered.
  if (!proposal) return null;

  if (state === "done") {
    return (
      <Card aria-live="polite">
        <CardContent className="pt-6 text-sm">
          ✓ {pastTense(proposal)} applied.
        </CardContent>
      </Card>
    );
  }
  if (state === "cancelled") {
    return (
      <Card aria-live="polite">
        <CardContent className="pt-6 text-sm text-muted-foreground">
          Proposal dismissed — nothing was changed.
        </CardContent>
      </Card>
    );
  }

  const errorMessage = commit.isError
    ? commit.error.data?.code === "NOT_FOUND"
      ? "That campaign or entity could not be found."
      : commit.error.data?.code === "BAD_REQUEST"
        ? "The proposed change was not valid."
        : "The change could not be applied. Please try again."
    : null;

  return (
    <Card aria-label="Proposed change">
      <CardHeader>
        <CardTitle className="text-base">{headline(proposal)}</CardTitle>
      </CardHeader>
      <CardContent className="text-sm">
        <dl className="space-y-1">
          {summaryRows(proposal).map(([label, value]) => (
            <div key={label} className="flex gap-2">
              <dt className="font-medium text-muted-foreground">{label}:</dt>
              <dd className="whitespace-pre-wrap">{value}</dd>
            </div>
          ))}
        </dl>
        {errorMessage ? (
          <p role="alert" className="mt-3 text-destructive">
            {errorMessage}
          </p>
        ) : null}
      </CardContent>
      <CardFooter className="gap-2">
        <Button
          type="button"
          disabled={commit.isPending}
          onClick={() => commit.mutate(proposalToInput(proposal))}
        >
          {commit.isPending ? "Applying…" : "Confirm"}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={commit.isPending}
          onClick={() => setState("cancelled")}
        >
          Cancel
        </Button>
      </CardFooter>
    </Card>
  );
}

function headline(p: Proposal): string {
  const verb = p.action[0]!.toUpperCase() + p.action.slice(1);
  return `${verb} ${p.entity}: ${proposalTitle(p)}`;
}

function pastTense(p: Proposal): string {
  const word =
    p.action === "create" ? "Creation" : p.action === "update" ? "Update" : "Deletion";
  return `${word} of ${p.entity} "${proposalTitle(p)}"`;
}

// Human-readable summary rows of what will change. Values are plain text (never raw HTML).
function summaryRows(p: Proposal): Array<[string, string]> {
  if (p.action === "delete") {
    return [["Delete", `${p.entity} "${p.target}"`]];
  }
  const fields = p.action === "create" ? p.fields : p.fields;
  const rows: Array<[string, string]> = [];
  if (p.action === "update") rows.push(["Target", p.target]);
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined || value === null) continue;
    rows.push([key, value instanceof Date ? value.toLocaleString() : String(value)]);
  }
  return rows;
}

// Map the typed proposal to the commit mutation input (the envelope shape).
function proposalToInput(p: Proposal) {
  if (p.action === "create") {
    return { action: p.action, entity: p.entity, campaignId: p.campaignId, fields: p.fields };
  }
  if (p.action === "update") {
    return {
      action: p.action,
      entity: p.entity,
      campaignId: p.campaignId,
      target: p.target,
      fields: p.fields,
    };
  }
  return { action: p.action, entity: p.entity, campaignId: p.campaignId, target: p.target };
}

// Refresh the list the change affects so the page reflects the new state.
async function invalidateFor(
  utils: ReturnType<typeof api.useUtils>,
  entity: Proposal["entity"],
  campaignId: string,
): Promise<void> {
  const input = { campaignId };
  switch (entity) {
    case "npc":
      return utils.npc.listByCampaign.invalidate(input);
    case "location":
      return utils.location.listByCampaign.invalidate(input);
    case "item":
      return utils.item.listByCampaign.invalidate(input);
    case "session":
      return utils.session.listByCampaign.invalidate(input);
    case "character":
      return utils.character.listByCampaign.invalidate(input);
  }
}
