import Link from "next/link";

import { CampaignForm } from "@/components/campaigns/campaign-form";

export default function NewCampaignPage() {
  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/campaigns"
          className="text-sm text-muted-foreground hover:underline"
        >
          ← Campaigns
        </Link>
        <h1 className="text-2xl font-semibold">New campaign</h1>
      </div>
      <CampaignForm />
    </div>
  );
}
