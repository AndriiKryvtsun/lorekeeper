import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock the Supabase server client so we can drive auth.getUser() outcomes.
const getUser = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(async () => ({ auth: { getUser } })),
}));

const { getCurrentUser } = await import("./getCurrentUser");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getCurrentUser", () => {
  it("returns the user when there is a session", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
    const user = await getCurrentUser();
    expect(user).toEqual({ id: "user-1" });
  });

  it("returns null when there is no session", async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: null });
    const user = await getCurrentUser();
    expect(user).toBeNull();
  });
});
