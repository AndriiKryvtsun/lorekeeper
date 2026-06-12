import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Control the user the proxy sees by mocking the Supabase SSR client.
const getUser = vi.fn();
vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(() => ({ auth: { getUser } })),
}));

const { proxy } = await import("./proxy");

function req(path: string): NextRequest {
  return new NextRequest(new URL(`http://localhost:3000${path}`));
}
const asAnon = () => getUser.mockResolvedValue({ data: { user: null } });
const asUser = () => getUser.mockResolvedValue({ data: { user: { id: "u1" } } });

beforeEach(() => vi.clearAllMocks());

describe("proxy redirects", () => {
  it("redirects an anonymous user from a protected route to /sign-in", async () => {
    asAnon();
    const res = await proxy(req("/campaigns"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/sign-in");
  });

  it("401s an anonymous API request", async () => {
    asAnon();
    const res = await proxy(req("/api/trpc/x"));
    expect(res.status).toBe(401);
  });

  it("allows an anonymous user to reach /sign-in", async () => {
    asAnon();
    const res = await proxy(req("/sign-in"));
    expect(res.status).toBe(200);
  });

  it("allows an anonymous user to reach /reset-password", async () => {
    asAnon();
    const res = await proxy(req("/reset-password"));
    expect(res.status).toBe(200);
  });

  it("redirects a signed-in user away from /sign-in to /campaigns", async () => {
    asUser();
    const res = await proxy(req("/sign-in"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/campaigns");
  });

  it("lets a signed-in user reach a protected route", async () => {
    asUser();
    const res = await proxy(req("/campaigns"));
    expect(res.status).toBe(200);
  });
});
