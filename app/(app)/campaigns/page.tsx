import { Plus } from "lucide-react";
import Link from "next/link";
import type { CSSProperties } from "react";

import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { api } from "~/trpc/server";

// Server Component: lists only the current user's campaigns via the RSC caller.
export default async function CampaignsPage() {
  const campaigns = await api.campaign.list();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Campaigns</h1>
        <Button asChild>
          <Link href="/campaigns/new">
            <Plus aria-hidden="true" />
            New campaign
          </Link>
        </Button>
      </div>

      {campaigns.length === 0 ? (
        <EmptyState
          title="No campaigns yet"
          description="Create your first campaign to start tracking sessions, NPCs, and more."
          action={
            <Button asChild>
              <Link href="/campaigns/new">Create campaign</Link>
            </Button>
          }
        />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {campaigns.map((campaign, index) => (
            <li
              key={campaign.id}
              className="lk-animate-item"
              style={{ "--lk-index": index } as CSSProperties}
            >
              <Link
                href={`/campaigns/${campaign.id}`}
                className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Card className="transition-[box-shadow,background-color] duration-[var(--duration-base)] hover:bg-accent hover:shadow-md">
                  <CardHeader>
                    <CardTitle>{campaign.title}</CardTitle>
                    <CardDescription>{campaign.system}</CardDescription>
                  </CardHeader>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
