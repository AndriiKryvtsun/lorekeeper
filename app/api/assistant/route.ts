import { NextResponse } from "next/server";

import { auditAssistantCall } from "@/lib/ai/audit";
import { AssistantHttpError, runAssistant } from "@/lib/ai/assistant-service";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import {
  enforceRateLimits,
  isOverDailyBudget,
  isOverRequestSize,
} from "@/lib/security/limits";
import { isSameOrigin } from "@/lib/security/origin";
import { assistantInputSchema } from "@/lib/validation/assistant";

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

// The text of one useChat message, whichever shape it arrives in (parts, or a plain string).
function readContent(message: object): string {
  const parts = (message as { parts?: unknown }).parts;
  if (Array.isArray(parts)) {
    return parts
      .filter(
        (p) => p && typeof p === "object" && (p as { type?: unknown }).type === "text",
      )
      .map((p) => String((p as { text?: unknown }).text ?? ""))
      .join("\n");
  }
  const content = (message as { content?: unknown }).content;
  return typeof content === "string" ? content : "";
}

// The unfinished write the client echoed back, if any. Read as-is and validated by the schema.
function readPending(raw: unknown): unknown {
  if (!raw || typeof raw !== "object") return undefined;
  return (raw as { pending?: unknown }).pending;
}

// Extract the conversation from the request body, oldest first. The client sends a bounded
// `history` (see MAX_HISTORY_TURNS); `messages` is the useChat default and is used when it does
// not. Only user and assistant turns are kept — a forged role or a tool part is dropped here
// rather than being validated into the pipeline. The count is bounded by the schema.
function readMessages(raw: unknown): { role: string; content: string }[] {
  if (!raw || typeof raw !== "object") return [];
  const body = raw as { history?: unknown; messages?: unknown };
  const source = Array.isArray(body.history) ? body.history : body.messages;
  if (!Array.isArray(source)) return [];
  return source
    .filter((m): m is object => Boolean(m) && typeof m === "object")
    .filter((m) => {
      const role = (m as { role?: unknown }).role;
      return role === "user" || role === "assistant";
    })
    .map((m) => ({
      role: String((m as { role?: unknown }).role),
      content: readContent(m),
    }));
}

export async function POST(req: Request) {
  // Defense-in-depth CSRF: reject cross-origin state-changing requests.
  if (!isSameOrigin(req)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

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

  // Reject oversized bodies before parsing (centralized request-size limit).
  if (isOverRequestSize(req)) {
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
    messages: readMessages(raw),
    pending: readPending(raw),
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  try {
    return await runAssistant({
      user,
      campaignId: parsed.data.campaignId,
      messages: parsed.data.messages,
      pending: parsed.data.pending,
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
