import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock the worker and a configured cron secret. The route must fail-closed without the secret.
const { processPendingSummaries } = vi.hoisted(() => ({
  processPendingSummaries: vi.fn(),
}));
vi.mock("@/lib/summaries/worker", () => ({ processPendingSummaries }));
vi.mock("~/env", () => ({ env: { CRON_SECRET: "test-secret" } }));

const { GET } = await import("./route");

function req(headers: Record<string, string> = {}): Request {
  return new Request("http://localhost/api/cron/summarize-sessions", { headers });
}

beforeEach(() => {
  vi.clearAllMocks();
  processPendingSummaries.mockResolvedValue({ claimed: 0, summarized: 0, skipped: 0, failed: 0 });
});

describe("cron summarize-sessions route", () => {
  it("rejects a request without the cron secret (401) and runs no summarization", async () => {
    const res = await GET(req());
    expect(res.status).toBe(401);
    expect(processPendingSummaries).not.toHaveBeenCalled();
  });

  it("rejects a wrong secret", async () => {
    const res = await GET(req({ authorization: "Bearer wrong" }));
    expect(res.status).toBe(401);
    expect(processPendingSummaries).not.toHaveBeenCalled();
  });

  it("runs the worker when the correct bearer secret is presented", async () => {
    const res = await GET(req({ authorization: "Bearer test-secret" }));
    expect(res.status).toBe(200);
    expect(processPendingSummaries).toHaveBeenCalledTimes(1);
  });
});
