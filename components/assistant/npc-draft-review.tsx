"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/use-toast";
import { createNpcSchema, type CreateNpcInput } from "@/lib/validation/npc";
import { api } from "~/trpc/react";

// Editable review for a drafted NPC. The model's draft is editable here; only an explicit Save
// persists it — through the existing commitProposal boundary (re-auth, re-validate, re-check
// ownership, sanitize). Validates client-side against the SAME schema the server re-validates.
export function NpcDraftReview({
  campaignId,
  draft,
  onClose,
}: {
  campaignId: string;
  draft: CreateNpcInput;
  onClose: () => void;
}) {
  const router = useRouter();
  const utils = api.useUtils();
  const form = useForm<typeof createNpcSchema._input>({
    resolver: zodResolver(createNpcSchema),
    defaultValues: {
      name: draft.name,
      role: draft.role,
      status: draft.status,
      description: draft.description,
    },
  });
  const errors = form.formState.errors;

  const commit = api.assistant.commitProposal.useMutation({
    onSuccess: async () => {
      toast({ title: "NPC created" });
      await utils.npc.listByCampaign.invalidate({ campaignId });
      router.refresh();
      onClose();
    },
    onError: (error) => {
      toast({
        title:
          error.data?.code === "NOT_FOUND"
            ? "Campaign not found"
            : "Could not save NPC",
        variant: "destructive",
      });
    },
  });

  const onSubmit = form.handleSubmit((values) => {
    commit.mutate({ action: "create", entity: "npc", campaignId, fields: values });
  });

  return (
    <Card aria-label="Review drafted NPC" className="mt-3">
      <CardHeader>
        <CardTitle className="text-base">Review drafted NPC</CardTitle>
      </CardHeader>
      <form onSubmit={onSubmit} noValidate>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="npc-name">Name</Label>
            <Input id="npc-name" aria-invalid={!!errors.name} {...form.register("name")} />
            {errors.name ? (
              <p role="alert" className="text-sm text-destructive">
                {errors.name.message}
              </p>
            ) : null}
          </div>
          <div className="space-y-1">
            <Label htmlFor="npc-role">Role</Label>
            <Input id="npc-role" aria-invalid={!!errors.role} {...form.register("role")} />
            {errors.role ? (
              <p role="alert" className="text-sm text-destructive">
                {errors.role.message}
              </p>
            ) : null}
          </div>
          <div className="space-y-1">
            <Label htmlFor="npc-status">Status</Label>
            <Input
              id="npc-status"
              aria-invalid={!!errors.status}
              {...form.register("status")}
            />
            {errors.status ? (
              <p role="alert" className="text-sm text-destructive">
                {errors.status.message}
              </p>
            ) : null}
          </div>
          <div className="space-y-1">
            <Label htmlFor="npc-description">Description</Label>
            <Textarea
              id="npc-description"
              aria-invalid={!!errors.description}
              {...form.register("description")}
            />
            {errors.description ? (
              <p role="alert" className="text-sm text-destructive">
                {errors.description.message}
              </p>
            ) : null}
          </div>
        </CardContent>
        <CardFooter className="gap-2">
          <Button type="submit" disabled={commit.isPending}>
            {commit.isPending ? "Saving…" : "Save"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={commit.isPending}
          >
            Cancel
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
