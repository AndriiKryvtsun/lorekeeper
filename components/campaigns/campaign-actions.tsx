"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";
import { api } from "~/trpc/react";

export function CampaignActions({ campaignId }: { campaignId: string }) {
  const router = useRouter();
  const del = api.campaign.delete.useMutation();

  async function onDelete() {
    if (!window.confirm("Delete this campaign and all its contents?")) return;
    try {
      await del.mutateAsync({ id: campaignId });
      toast({ title: "Campaign deleted" });
      router.push("/campaigns");
      router.refresh();
    } catch {
      toast({ title: "Could not delete campaign", variant: "destructive" });
    }
  }

  return (
    <div className="flex gap-2">
      <Button asChild variant="outline" size="sm">
        <Link href={`/campaigns/${campaignId}/edit`}>Edit</Link>
      </Button>
      <Button variant="outline" size="sm" onClick={onDelete}>
        Delete
      </Button>
    </div>
  );
}
