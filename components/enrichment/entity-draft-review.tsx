"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, type FieldValues, type Path, type Resolver } from "react-hook-form";

import { FormField } from "@/components/campaigns/form-field";
import { useEnrichmentCommit } from "@/components/enrichment/use-enrichment-commit";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/use-toast";
import { createCharacterSchema } from "@/lib/validation/character";
import { createNpcSchema } from "@/lib/validation/npc";
import type { EnrichProvenance } from "@/components/enrichment/enrich-controls";

type FieldDef = { name: string; label: string; control?: "textarea" | "number" };

const FIELDS: Record<"npc" | "character", FieldDef[]> = {
  npc: [
    { name: "name", label: "Name" },
    { name: "role", label: "Role" },
    { name: "status", label: "Status" },
    { name: "description", label: "Description", control: "textarea" },
  ],
  character: [
    { name: "name", label: "Name" },
    { name: "playerName", label: "Player" },
    { name: "class", label: "Class" },
    { name: "level", label: "Level", control: "number" },
    { name: "notes", label: "Notes", control: "textarea" },
  ],
};

// Editable review for a drafted NPC/Character from EITHER source. Nothing is written until the
// user clicks Apply; the commit goes through the unified commitProposal path (re-validate,
// re-check ownership, sanitize) carrying source/attribution, and refreshes the campaign lists.
export function EntityDraftReview<TForm extends FieldValues>({
  kind,
  campaignId,
  draft,
  provenance,
  onClose,
}: {
  kind: "npc" | "character";
  campaignId: string;
  draft: Partial<TForm>;
  provenance: EnrichProvenance;
  onClose: () => void;
}) {
  const commit = useEnrichmentCommit(campaignId);
  const schema = kind === "npc" ? createNpcSchema : createCharacterSchema;
  const form = useForm<TForm>({
    // Both branches are ZodObjects; the union confuses zodResolver's overloads, so narrow to
    // one concrete schema type for the call and erase the form generic at the boundary.
    resolver: zodResolver(schema as typeof createNpcSchema) as unknown as Resolver<TForm>,
    defaultValues: draft as never,
  });
  const errors = form.formState.errors;

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await commit.mutateAsync({
        action: "create",
        entity: kind,
        campaignId,
        fields: values,
        source: provenance.source,
        attribution: provenance.attribution,
      });
      toast({ title: `${kind === "npc" ? "NPC" : "Character"} created` });
      onClose();
    } catch {
      toast({ title: "Could not save", variant: "destructive" });
    }
  });

  return (
    <Card aria-label={`Review drafted ${kind}`} className="mt-3">
      <CardHeader>
        <CardTitle className="text-base">
          Review drafted {kind === "npc" ? "NPC" : "character"}
        </CardTitle>
      </CardHeader>
      <form onSubmit={onSubmit} noValidate>
        <CardContent className="space-y-3">
          {FIELDS[kind].map((field) => (
            <FormField
              key={field.name}
              label={field.label}
              error={errors[field.name as Path<TForm>]?.message as string}
            >
              {(props) =>
                field.control === "textarea" ? (
                  <Textarea {...props} {...form.register(field.name as Path<TForm>)} />
                ) : (
                  <Input
                    {...props}
                    type={field.control === "number" ? "number" : "text"}
                    {...form.register(field.name as Path<TForm>)}
                  />
                )
              }
            </FormField>
          ))}
          {provenance.attribution ? (
            <p className="text-xs text-muted-foreground">{provenance.attribution}</p>
          ) : null}
        </CardContent>
        <CardFooter className="gap-2">
          <Button type="submit" disabled={commit.isPending}>
            {commit.isPending ? "Saving…" : "Apply"}
          </Button>
          <Button type="button" variant="outline" onClick={onClose} disabled={commit.isPending}>
            Cancel
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
