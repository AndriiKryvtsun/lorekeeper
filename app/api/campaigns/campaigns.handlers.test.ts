import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock auth and the owner-scoped data layer so handler tests run without a DB or session.
vi.mock("@/lib/auth/getCurrentUser", () => ({ getCurrentUser: vi.fn() }));
vi.mock("@/lib/data/campaigns", () => ({
  listCampaigns: vi.fn(),
  createCampaign: vi.fn(),
  getCampaign: vi.fn(),
  updateCampaign: vi.fn(),
  deleteCampaign: vi.fn(),
}));

const { getCurrentUser } = await import("@/lib/auth/getCurrentUser");
const data = await import("@/lib/data/campaigns");
const { GET, POST } = await import("./route");
const { GET: GET_ONE, PATCH, DELETE } = await import("./[campaignId]/route");

const authMock = getCurrentUser as unknown as ReturnType<typeof vi.fn>;
const dataMock = data as unknown as Record<string, ReturnType<typeof vi.fn>>;

const USER = { id: "user-1" };

function jsonRequest(method: string, body: unknown) {
  return new Request("http://localhost/api/campaigns", {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  authMock.mockResolvedValue(USER);
});

describe("authentication", () => {
  it("GET returns 401 when there is no session", async () => {
    authMock.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
    expect(dataMock.listCampaigns).not.toHaveBeenCalled();
  });

  it("POST returns 401 when there is no session and writes nothing", async () => {
    authMock.mockResolvedValue(null);
    const res = await POST(jsonRequest("POST", { title: "T", system: "S" }));
    expect(res.status).toBe(401);
    expect(dataMock.createCampaign).not.toHaveBeenCalled();
  });
});

describe("GET /api/campaigns", () => {
  it("lists only the current user's campaigns", async () => {
    dataMock.listCampaigns.mockResolvedValue([{ id: "c1", ownerId: "user-1" }]);
    const res = await GET();
    expect(res.status).toBe(200);
    expect(dataMock.listCampaigns).toHaveBeenCalledWith("user-1");
  });
});

describe("POST /api/campaigns", () => {
  it("creates a campaign with ownerId from the session, not the body", async () => {
    dataMock.createCampaign.mockResolvedValue({ id: "c1", ownerId: "user-1" });
    const res = await POST(
      jsonRequest("POST", { title: "T", system: "S", ownerId: "attacker" }),
    );
    expect(res.status).toBe(201);
    // ownerId arg is the session user; the body's ownerId is ignored/stripped.
    expect(dataMock.createCampaign).toHaveBeenCalledWith("user-1", {
      title: "T",
      system: "S",
    });
  });

  it("rejects invalid input with 400 and does not write", async () => {
    const res = await POST(jsonRequest("POST", { system: "S" }));
    expect(res.status).toBe(400);
    expect(dataMock.createCampaign).not.toHaveBeenCalled();
  });
});

describe("GET /api/campaigns/{campaignId}", () => {
  it("returns 404 for a missing or unowned campaign", async () => {
    dataMock.getCampaign.mockResolvedValue(null);
    const res = await GET_ONE(new Request("http://localhost/x"), {
      params: Promise.resolve({ campaignId: "other-users" }),
    });
    expect(res.status).toBe(404);
    expect(dataMock.getCampaign).toHaveBeenCalledWith("user-1", "other-users");
  });

  it("returns the owned campaign", async () => {
    dataMock.getCampaign.mockResolvedValue({ id: "c1", ownerId: "user-1" });
    const res = await GET_ONE(new Request("http://localhost/x"), {
      params: Promise.resolve({ campaignId: "c1" }),
    });
    expect(res.status).toBe(200);
  });
});

describe("PATCH /api/campaigns/{campaignId}", () => {
  it("returns 404 when the campaign is missing or unowned", async () => {
    dataMock.updateCampaign.mockResolvedValue(null);
    const res = await PATCH(jsonRequest("PATCH", { title: "New" }), {
      params: Promise.resolve({ campaignId: "other-users" }),
    });
    expect(res.status).toBe(404);
  });
});

describe("DELETE /api/campaigns/{campaignId}", () => {
  it("returns 204 when an owned campaign is deleted", async () => {
    dataMock.deleteCampaign.mockResolvedValue(true);
    const res = await DELETE(new Request("http://localhost/x"), {
      params: Promise.resolve({ campaignId: "c1" }),
    });
    expect(res.status).toBe(204);
  });

  it("returns 404 when deleting a missing or unowned campaign", async () => {
    dataMock.deleteCampaign.mockResolvedValue(false);
    const res = await DELETE(new Request("http://localhost/x"), {
      params: Promise.resolve({ campaignId: "other-users" }),
    });
    expect(res.status).toBe(404);
  });
});
