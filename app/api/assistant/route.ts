import { NextResponse } from "next/server";

import { auditAssistantCall } from "@/lib/ai/audit";
import { AssistantHttpError, runAssistant } from "@/lib/ai/assistant-service";
import { enforceRateLimits, isOverDailyBudget } from "@/lib/ai/rate-limit";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { assistantInputSchema, MAX_BODY_BYTES } from "@/lib/validation/assistant";

// Node runtime: the Prisma pg adapter (used by the owner-scoped data layer) is not Edge-safe.
export const runtime = "nodejs";
export const maxDuration = 60;

function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

function readCampaignId(raw: unknown): string {
  if (raw && typeof raw === "object" && "campaignId" in raw) {
    const v = (raw as { campaignId?: unknown }).campaignId;
    if (typeof v === "string") return v;
  }
  return "";
}

// Extract the latest user message text from the useChat request body.
function readQuestion(raw: unknown): string {
  if (!raw || typeof raw !== "object" || !("messages" in raw)) return "";
  const messages = (raw as { messages?: unknown }).messages;
  if (!Array.isArray(messages)) return "";
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const m = messages[i];
    if (!m || typeof m !== "object" || (m as { role?: unknown }).role !== "user") {
      continue;
    }
    const parts = (m as { parts?: unknown }).parts;
    if (Array.isArray(parts)) {
      return parts
        .filter((p) => p && typeof p === "object" && (p as { type?: unknown }).type === "text")
        .map((p) => String((p as { text?: unknown }).text ?? ""))
        .join("\n");
    }
    const content = (m as { content?: unknown }).content;
    if (typeof content === "string") return content;
  }
  return "";
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Abuse controls before any retrieval or model call.
  const ip = clientIp(req);
  const limited = await enforceRateLimits(user.id, ip);
  if (!limited.ok) {
    auditAssistantCall({
      userId: user.id,
      campaignId: "-",
      outcome: "blocked",
      reason: `rate_limit:${limited.reason}`,
    });
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }
  if (await isOverDailyBudget(user.id)) {
    auditAssistantCall({
      userId: user.id,
      campaignId: "-",
      outcome: "blocked",
      reason: "over_budget",
    });
    return NextResponse.json(
      { error: "Daily token budget exceeded" },
      { status: 429 },
    );
  }

  // Reject oversized bodies before parsing.
  const contentLength = Number(req.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Request too large" }, { status: 413 });
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = assistantInputSchema.safeParse({
    campaignId: readCampaignId(raw),
    question: readQuestion(raw),
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  try {
    return await runAssistant({
      user,
      campaignId: parsed.data.campaignId,
      question: parsed.data.question,
      signal: req.signal,
    });
  } catch (error) {
    if (error instanceof AssistantHttpError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    auditAssistantCall({
      userId: user.id,
      campaignId: parsed.data.campaignId,
      outcome: "error",
    });
    return NextResponse.json({ error: "Assistant error" }, { status: 500 });
  }
}
