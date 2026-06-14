import Link from "next/link";
import { notFound } from "next/navigation";

import { CampaignActions } from "@/components/campaigns/campaign-actions";
import { CampaignChildren } from "@/components/campaigns/campaign-children";
import { CampaignChat } from "@/components/assistant/campaign-chat";
import { api } from "~/trpc/server";

// Server Component: fetches the campaign and all child lists via the RSC caller, then
// hands them to a Client wrapper as initial data for interactive sections.
export default async function CampaignDetailPage({
  params,
}: {
  params: Promise<{ campaignId: string }>;
}) {
  const { campaignId } = await params;

  // byId throws NOT_FOUND for missing/unowned campaigns; render the not-found UI.
  const campaign = await api.campaign.byId({ id: campaignId }).catch(() => null);
  if (!campaign) {
    notFound();
  }

  const [npcs, sessions, locations, items, characters] = await Promise.all([
    api.npc.listByCampaign({ campaignId }),
    api.session.listByCampaign({ campaignId }),
    api.location.listByCampaign({ campaignId }),
    api.item.listByCampaign({ campaignId }),
    api.character.listByCampaign({ campaignId }),
  ]);

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <Link
          href="/campaigns"
          className="text-sm text-muted-foreground hover:underline"
        >
          ← Campaigns
        </Link>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">{campaign.title}</h1>
            <p className="text-muted-foreground">{campaign.system}</p>
          </div>
          <CampaignActions campaignId={campaign.id} />
        </div>
        {campaign.description ? (
          <p className="whitespace-pre-wrap">{campaign.description}</p>
        ) : null}
      </div>

      <CampaignChildren
        campaignId={campaign.id}
        npcs={npcs}
        sessions={sessions}
        locations={locations}
        items={items}
        characters={characters}
      />

      <CampaignChat campaignId={campaign.id} />
    </div>
  );
}
