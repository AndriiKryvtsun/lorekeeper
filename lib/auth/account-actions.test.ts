import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock auth, the admin client, the data layer, and redirect to test the account server actions
// in isolation (no Supabase, no DB).
const { authState, deleteUser } = vi.hoisted(() => ({
  authState: {
    signInWithPassword: vi.fn(),
    updateUser: vi.fn(),
    signOut: vi.fn(),
  },
  deleteUser: vi.fn(),
}));
vi.mock("@/lib/auth/getCurrentUser", () => ({ getCurrentUser: vi.fn() }));
vi.mock("@/lib/data/profile", () => ({ deleteOwnedData: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => ({ auth: { admin: { deleteUser } } }),
}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(async () => ({ auth: authState })),
}));
vi.mock("next/headers", () => ({ headers: vi.fn(async () => ({ get: () => null })) }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
}));

const { getCurrentUser } = await import("@/lib/auth/getCurrentUser");
const profileData = await import("@/lib/data/profile");
const { signOutOtherDevices, deleteAccount } = await import("./actions");

const authMock = getCurrentUser as unknown as ReturnType<typeof vi.fn>;
const m = (fn: unknown) => fn as ReturnType<typeof vi.fn>;

function fd(entries: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) f.set(k, v);
  return f;
}

beforeEach(() => {
  vi.clearAllMocks();
  authMock.mockResolvedValue({ id: "u1", email: "me@example.com" });
  authState.signInWithPassword.mockResolvedValue({ error: null });
  authState.updateUser.mockResolvedValue({ error: null });
  authState.signOut.mockResolvedValue({ error: null });
  deleteUser.mockResolvedValue({ error: null });
  m(profileData.deleteOwnedData).mockResolvedValue(undefined);
});

describe("deleteAccount", () => {
  it("refuses when the typed email does not match the account", async () => {
    const res = await deleteAccount({ ok: false }, fd({ confirmEmail: "other@x.com", currentPassword: "pw" }));
    expect(res.ok).toBe(false);
    expect(profileData.deleteOwnedData).not.toHaveBeenCalled();
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it("refuses when reauthentication fails", async () => {
    authState.signInWithPassword.mockResolvedValue({ error: { message: "bad" } });
    const res = await deleteAccount({ ok: false }, fd({ confirmEmail: "me@example.com", currentPassword: "wrong" }));
    expect(res.ok).toBe(false);
    expect(profileData.deleteOwnedData).not.toHaveBeenCalled();
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it("deletes owned data and the auth user on confirmation + reauth, then redirects", async () => {
    await expect(
      deleteAccount({ ok: false }, fd({ confirmEmail: "me@example.com", currentPassword: "pw" })),
    ).rejects.toThrow("REDIRECT:/sign-in?deleted=1");
    expect(profileData.deleteOwnedData).toHaveBeenCalledWith("u1");
    expect(deleteUser).toHaveBeenCalledWith("u1");
    expect(authState.signOut).toHaveBeenCalledWith({ scope: "global" });
  });
});

describe("signOutOtherDevices", () => {
  it("revokes other sessions", async () => {
    const res = await signOutOtherDevices();
    expect(res.ok).toBe(true);
    expect(authState.signOut).toHaveBeenCalledWith({ scope: "others" });
  });
});
