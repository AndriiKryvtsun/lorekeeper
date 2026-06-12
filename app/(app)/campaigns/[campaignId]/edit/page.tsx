import Link from "next/link";
import { notFound } from "next/navigation";

import { CampaignForm } from "@/components/campaigns/campaign-form";
import { api } from "~/trpc/server";

export default async function EditCampaignPage({
  params,
}: {
  params: Promise<{ campaignId: string }>;
}) {
  const { campaignId } = await params;

  const campaign = await api.campaign.byId({ id: campaignId }).catch(() => null);
  if (!campaign) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/campaigns/${campaign.id}`}
          className="text-sm text-muted-foreground hover:underline"
        >
          ← {campaign.title}
        </Link>
        <h1 className="text-2xl font-semibold">Edit campaign</h1>
      </div>
      <CampaignForm campaign={campaign} />
    </div>
  );
}
