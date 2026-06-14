import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock auth, rate limiting, audit, and the pipeline so the route is tested in isolation
// (no real generation, Prisma, or Upstash). The mocked assistant-service exports the real-
// shaped AssistantHttpError so the route's instanceof check works against the same class.
vi.mock("@/lib/auth/getCurrentUser", () => ({ getCurrentUser: vi.fn() }));
vi.mock("@/lib/ai/rate-limit", () => ({
  enforceRateLimits: vi.fn(),
  isOverDailyBudget: vi.fn(),
}));
vi.mock("@/lib/ai/audit", () => ({ auditAssistantCall: vi.fn() }));
vi.mock("@/lib/ai/assistant-service", () => {
  class AssistantHttpError extends Error {
    constructor(
      readonly status: number,
      message: string,
    ) {
      super(message);
    }
  }
  return { runAssistant: vi.fn(), AssistantHttpError };
});

const { getCurrentUser } = await import("@/lib/auth/getCurrentUser");
const rl = await import("@/lib/ai/rate-limit");
const svc = await import("@/lib/ai/assistant-service");
const { POST } = await import("./route");

const authMock = getCurrentUser as unknown as ReturnType<typeof vi.fn>;
const enforce = rl.enforceRateLimits as unknown as ReturnType<typeof vi.fn>;
const overBudget = rl.isOverDailyBudget as unknown as ReturnType<typeof vi.fn>;
const runAssistant = svc.runAssistant as unknown as ReturnType<typeof vi.fn>;

function req(body: unknown): Request {
  return new Request("http://localhost/api/assistant", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}
const validBody = {
  campaignId: "c1",
  messages: [{ role: "user", parts: [{ type: "text", text: "Who is the innkeeper?" }] }],
};

beforeEach(() => {
  vi.clearAllMocks();
  authMock.mockResolvedValue({ id: "user-1" });
  enforce.mockResolvedValue({ ok: true });
  overBudget.mockResolvedValue(false);
  runAssistant.mockResolvedValue(new Response("ok"));
});

describe("auth", () => {
  it("returns 401 for an anonymous request and never generates", async () => {
    authMock.mockResolvedValue(null);
    const res = await POST(req(validBody));
    expect(res.status).toBe(401);
    expect(runAssistant).not.toHaveBeenCalled();
  });
});

describe("rate limits and budget", () => {
  it("returns 429 when the user/IP rate limit is exceeded (no generation)", async () => {
    enforce.mockResolvedValue({ ok: false, reason: "user" });
    const res = await POST(req(validBody));
    expect(res.status).toBe(429);
    expect(runAssistant).not.toHaveBeenCalled();
  });

  it("returns 429 when the daily token budget is exceeded", async () => {
    overBudget.mockResolvedValue(true);
    const res = await POST(req(validBody));
    expect(res.status).toBe(429);
    expect(runAssistant).not.toHaveBeenCalled();
  });
});

describe("input + delegation", () => {
  it("returns 400 for invalid input", async () => {
    const res = await POST(req({ messages: [] })); // no campaignId, no question
    expect(res.status).toBe(400);
    expect(runAssistant).not.toHaveBeenCalled();
  });

  it("delegates to the pipeline on a valid request", async () => {
    const res = await POST(req(validBody));
    expect(res.status).toBe(200);
    expect(runAssistant).toHaveBeenCalledWith(
      expect.objectContaining({ campaignId: "c1", question: "Who is the innkeeper?" }),
    );
  });

  it("maps a cross-user AssistantHttpError(404) to a 404 response", async () => {
    runAssistant.mockRejectedValue(new svc.AssistantHttpError(404, "Campaign not found"));
    const res = await POST(req(validBody));
    expect(res.status).toBe(404);
  });
});
