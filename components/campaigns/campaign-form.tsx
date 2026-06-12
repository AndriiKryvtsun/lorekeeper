"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import type { z } from "zod";

import { FormField } from "@/components/campaigns/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/use-toast";
import type { Campaign } from "@/app/generated/prisma/client";
import { createCampaignSchema } from "@/lib/validation/campaign";
import { api } from "~/trpc/react";

type FormValues = z.input<typeof createCampaignSchema>;
const emptyToUndefined = (v: string) => (v === "" ? undefined : v);

// Create/edit a campaign. Uses the SAME createCampaignSchema the procedure validates with.
export function CampaignForm({ campaign }: { campaign?: Campaign }) {
  const router = useRouter();
  const isEdit = Boolean(campaign);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(createCampaignSchema),
    defaultValues: {
      title: campaign?.title ?? "",
      system: campaign?.system ?? "",
      description: campaign?.description ?? undefined,
    },
  });

  const create = api.campaign.create.useMutation();
  const update = api.campaign.update.useMutation();

  const onSubmit = handleSubmit(async (values) => {
    try {
      const result = campaign
        ? await update.mutateAsync({ id: campaign.id, data: values })
        : await create.mutateAsync(values);
      toast({ title: isEdit ? "Campaign updated" : "Campaign created" });
      router.push(`/campaigns/${result.id}`);
      router.refresh();
    } catch {
      toast({
        title: isEdit ? "Could not update campaign" : "Could not create campaign",
        variant: "destructive",
      });
    }
  });

  return (
    <form onSubmit={onSubmit} className="max-w-lg space-y-4" noValidate>
      <FormField label="Title" error={errors.title?.message}>
        {(props) => <Input {...props} {...register("title")} />}
      </FormField>
      <FormField label="System" error={errors.system?.message}>
        {(props) => (
          <Input
            {...props}
            placeholder="e.g. D&D 5e"
            {...register("system")}
          />
        )}
      </FormField>
      <FormField label="Description" error={errors.description?.message}>
        {(props) => (
          <Textarea
            {...props}
            {...register("description", { setValueAs: emptyToUndefined })}
          />
        )}
      </FormField>
      <div className="flex gap-2">
        <Button type="submit" disabled={isSubmitting}>
          {isEdit ? "Save changes" : "Create campaign"}
        </Button>
        <Button type="button" variant="ghost" onClick={() => router.back()}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
