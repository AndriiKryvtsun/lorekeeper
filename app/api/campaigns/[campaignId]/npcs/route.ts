import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import {
  createNpcForOwnedCampaign,
  listNpcsForOwnedCampaign,
} from "@/lib/data/campaigns";
import { createNpcSchema } from "@/lib/validation/npc";

type RouteContext = { params: Promise<{ campaignId: string }> };

// GET /api/campaigns/{campaignId}/npcs — NPCs of a campaign the user owns, else 404.
export async function GET(_request: Request, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { campaignId } = await params;
  const npcs = await listNpcsForOwnedCampaign(user.id, campaignId);
  if (npcs === null) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }
  return NextResponse.json(npcs);
}

// POST /api/campaigns/{campaignId}/npcs — create an NPC under a campaign the user owns.
// The parent comes from the path; a missing or unowned campaign yields 404.
export async function POST(request: Request, { params }: RouteContext) {
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

  const parsed = createNpcSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const npc = await createNpcForOwnedCampaign(user.id, campaignId, parsed.data);
  if (npc === null) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }
  return NextResponse.json(npc, { status: 201 });
}
