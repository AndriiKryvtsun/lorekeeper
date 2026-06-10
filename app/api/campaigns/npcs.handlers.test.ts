import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock auth and the owner-scoped data layer so handler tests run without a DB or session.
vi.mock("@/lib/auth/getCurrentUser", () => ({ getCurrentUser: vi.fn() }));
vi.mock("@/lib/data/campaigns", () => ({
  listNpcsForOwnedCampaign: vi.fn(),
  createNpcForOwnedCampaign: vi.fn(),
}));

const { getCurrentUser } = await import("@/lib/auth/getCurrentUser");
const data = await import("@/lib/data/campaigns");
const { GET, POST } = await import("./[campaignId]/npcs/route");

const authMock = getCurrentUser as unknown as ReturnType<typeof vi.fn>;
const dataMock = data as unknown as Record<string, ReturnType<typeof vi.fn>>;

const USER = { id: "user-1" };

function jsonRequest(body: unknown) {
  return new Request("http://localhost/api/campaigns/c1/npcs", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  authMock.mockResolvedValue(USER);
});

describe("authentication", () => {
  it("GET returns 401 without a session", async () => {
    authMock.mockResolvedValue(null);
    const res = await GET(new Request("http://localhost/x"), {
      params: Promise.resolve({ campaignId: "c1" }),
    });
    expect(res.status).toBe(401);
    expect(dataMock.listNpcsForOwnedCampaign).not.toHaveBeenCalled();
  });

  it("POST returns 401 without a session and writes nothing", async () => {
    authMock.mockResolvedValue(null);
    const res = await POST(jsonRequest({ name: "Mara" }), {
      params: Promise.resolve({ campaignId: "c1" }),
    });
    expect(res.status).toBe(401);
    expect(dataMock.createNpcForOwnedCampaign).not.toHaveBeenCalled();
  });
});

describe("GET /api/campaigns/{campaignId}/npcs", () => {
  it("returns the owned campaign's NPCs", async () => {
    dataMock.listNpcsForOwnedCampaign.mockResolvedValue([{ id: "n1" }]);
    const res = await GET(new Request("http://localhost/x"), {
      params: Promise.resolve({ campaignId: "c1" }),
    });
    expect(res.status).toBe(200);
    expect(dataMock.listNpcsForOwnedCampaign).toHaveBeenCalledWith("user-1", "c1");
  });

  it("returns 404 for a missing or unowned campaign", async () => {
    dataMock.listNpcsForOwnedCampaign.mockResolvedValue(null);
    const res = await GET(new Request("http://localhost/x"), {
      params: Promise.resolve({ campaignId: "other-users" }),
    });
    expect(res.status).toBe(404);
  });
});

describe("POST /api/campaigns/{campaignId}/npcs", () => {
  it("creates an NPC under an owned campaign and returns 201", async () => {
    dataMock.createNpcForOwnedCampaign.mockResolvedValue({ id: "n1" });
    const res = await POST(jsonRequest({ name: "Mara" }), {
      params: Promise.resolve({ campaignId: "c1" }),
    });
    expect(res.status).toBe(201);
    expect(dataMock.createNpcForOwnedCampaign).toHaveBeenCalledWith("user-1", "c1", {
      name: "Mara",
      status: "alive",
    });
  });

  it("returns 404 when the campaign is missing or unowned and writes nothing", async () => {
    dataMock.createNpcForOwnedCampaign.mockResolvedValue(null);
    const res = await POST(jsonRequest({ name: "Mara" }), {
      params: Promise.resolve({ campaignId: "other-users" }),
    });
    expect(res.status).toBe(404);
  });

  it("returns 400 on invalid input and does not write", async () => {
    const res = await POST(jsonRequest({ role: "Innkeeper" }), {
      params: Promise.resolve({ campaignId: "c1" }),
    });
    expect(res.status).toBe(400);
    expect(dataMock.createNpcForOwnedCampaign).not.toHaveBeenCalled();
  });
});
