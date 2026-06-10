import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import {
  deleteCampaign,
  getCampaign,
  updateCampaign,
} from "@/lib/data/campaigns";
import { updateCampaignSchema } from "@/lib/validation/campaign";

type RouteContext = { params: Promise<{ campaignId: string }> };

// GET /api/campaigns/{campaignId} — read one campaign the user owns, else 404.
export async function GET(_request: Request, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { campaignId } = await params;
  const campaign = await getCampaign(user.id, campaignId);
  if (!campaign) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }
  return NextResponse.json(campaign);
}

// PATCH /api/campaigns/{campaignId} — update a campaign the user owns, else 404.
export async function PATCH(request: Request, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { campaignId } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = updateCampaignSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const campaign = await updateCampaign(user.id, campaignId, parsed.data);
  if (!campaign) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }
  return NextResponse.json(campaign);
}

// DELETE /api/campaigns/{campaignId} — delete a campaign the user owns, else 404.
export async function DELETE(_request: Request, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { campaignId } = await params;
  const deleted = await deleteCampaign(user.id, campaignId);
  if (!deleted) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }
  return new NextResponse(null, { status: 204 });
}
