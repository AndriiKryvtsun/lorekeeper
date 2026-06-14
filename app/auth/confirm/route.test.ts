import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock the Supabase server client so the route is tested without real auth.
const { verifyOtp, exchangeCodeForSession } = vi.hoisted(() => ({
  verifyOtp: vi.fn(),
  exchangeCodeForSession: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(async () => ({
    auth: { verifyOtp, exchangeCodeForSession },
  })),
}));

const { GET } = await import("./route");

const loc = (res: Response) => new URL(res.headers.get("location") ?? "", "http://localhost");
const get = (qs: string) => GET(new Request(`http://localhost/auth/confirm?${qs}`));

beforeEach(() => {
  vi.clearAllMocks();
  verifyOtp.mockResolvedValue({ error: null });
  exchangeCodeForSession.mockResolvedValue({ error: null });
});

describe("/auth/confirm", () => {
  it("verifies a token_hash recovery link and redirects to next (reset-password)", async () => {
    const res = await get("token_hash=abc&type=recovery&next=/reset-password");
    expect(verifyOtp).toHaveBeenCalledWith({ token_hash: "abc", type: "recovery" });
    expect(loc(res).pathname).toBe("/reset-password");
  });

  it("exchanges a PKCE code (default template) and redirects to next", async () => {
    const res = await get("code=xyz&next=/reset-password");
    expect(exchangeCodeForSession).toHaveBeenCalledWith("xyz");
    expect(loc(res).pathname).toBe("/reset-password");
  });

  it("redirects to sign-in when neither token_hash nor code is present", async () => {
    const res = await get("next=/reset-password");
    expect(verifyOtp).not.toHaveBeenCalled();
    expect(exchangeCodeForSession).not.toHaveBeenCalled();
    const u = loc(res);
    expect(u.pathname).toBe("/sign-in");
    expect(u.searchParams.get("error")).toBe("invalid_link");
  });

  it("redirects to sign-in when code exchange fails", async () => {
    exchangeCodeForSession.mockResolvedValue({ error: { message: "bad code" } });
    const res = await get("code=xyz&next=/reset-password");
    expect(loc(res).pathname).toBe("/sign-in");
  });

  it("defaults next to /campaigns for a non-recovery confirmation", async () => {
    const res = await get("token_hash=abc&type=email");
    expect(loc(res).pathname).toBe("/campaigns");
  });
});
