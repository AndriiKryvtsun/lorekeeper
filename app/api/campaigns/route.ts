import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { createCampaign, listCampaigns } from "@/lib/data/campaigns";
import { createCampaignSchema } from "@/lib/validation/campaign";

// GET /api/campaigns — list only the authenticated user's campaigns.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const campaigns = await listCampaigns(user.id);
  return NextResponse.json(campaigns);
}

// POST /api/campaigns — create a campaign owned by the authenticated user.
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = createCampaignSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  // ownerId comes from the session, never from the body (the schema has no ownerId).
  const campaign = await createCampaign(user.id, parsed.data);
  return NextResponse.json(campaign, { status: 201 });
}
