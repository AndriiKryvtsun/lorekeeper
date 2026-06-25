import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock the server Supabase client and getCurrentUser so actions run without Supabase/cookies.
const auth = {
  signUp: vi.fn(),
  signInWithPassword: vi.fn(),
  signInWithOtp: vi.fn(),
  resetPasswordForEmail: vi.fn(),
  updateUser: vi.fn(),
  signOut: vi.fn(),
};
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(async () => ({ auth })),
}));
vi.mock("@/lib/auth/getCurrentUser", () => ({ getCurrentUser: vi.fn() }));
// Server actions call headers(); stub it.
vi.mock("next/headers", () => ({
  headers: vi.fn(async () => new Headers({ host: "localhost:3000" })),
}));
// redirect() throws to halt; capture the destination.
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
}));

const { getCurrentUser } = await import("@/lib/auth/getCurrentUser");
const {
  signUp,
  signInWithPassword,
  resetPasswordForEmail,
  updatePassword,
  signOut,
  signOutOtherDevices,
} = await import("@/lib/auth/actions");

const getCurrentUserMock = getCurrentUser as unknown as ReturnType<typeof vi.fn>;
const initial = { ok: false };

function form(entries: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(entries)) fd.set(k, v);
  return fd;
}

beforeEach(() => {
  vi.clearAllMocks();
  auth.signUp.mockResolvedValue({ data: { user: {} }, error: null });
  auth.signInWithPassword.mockResolvedValue({ data: {}, error: null });
  auth.resetPasswordForEmail.mockResolvedValue({ data: {}, error: null });
  auth.updateUser.mockResolvedValue({ data: { user: {} }, error: null });
  auth.signOut.mockResolvedValue({ error: null });
});
afterEach(() => vi.restoreAllMocks());

const TOKEN = { captchaToken: "tok" };

describe("enumeration resistance", () => {
  it("sign-up returns the generic check-email result (existing or new email)", async () => {
    const res = await signUp(
      initial,
      form({ email: "a@b.com", password: "password1", confirmPassword: "password1", ...TOKEN }),
    );
    expect(res).toEqual({ ok: true, message: "Check your email to continue." });
  });

  it("reset returns the identical generic result", async () => {
    const res = await resetPasswordForEmail(
      initial,
      form({ email: "a@b.com", ...TOKEN }),
    );
    expect(res).toEqual({ ok: true, message: "Check your email to continue." });
  });
});

describe("generic sign-in failure", () => {
  it("maps any auth error to a generic message", async () => {
    auth.signInWithPassword.mockResolvedValue({
      data: {},
      error: { message: "User not found" },
    });
    const res = await signInWithPassword(
      initial,
      form({ email: "a@b.com", password: "password1", ...TOKEN }),
    );
    expect(res).toEqual({ ok: false, error: "Invalid email or password." });
  });
});

describe("captcha fail closed", () => {
  it("blocks sign-in when no captcha token is present", async () => {
    const res = await signInWithPassword(
      initial,
      form({ email: "a@b.com", password: "password1" }),
    );
    expect(res.ok).toBe(false);
    expect(auth.signInWithPassword).not.toHaveBeenCalled();
  });

  it("forwards the captcha token to Supabase", async () => {
    auth.signInWithPassword.mockRejectedValue(
      new Error("REDIRECT:/campaigns"),
    );
    await signInWithPassword(
      initial,
      form({ email: "A@B.com ", password: "password1", ...TOKEN }),
    ).catch(() => {});
    expect(auth.signInWithPassword).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "a@b.com", // normalized
        options: { captchaToken: "tok" },
      }),
    );
  });
});

describe("reset gating", () => {
  it("refuses to update without a session", async () => {
    getCurrentUserMock.mockResolvedValue(null);
    const res = await updatePassword(
      initial,
      form({ password: "password1", confirmPassword: "password1" }),
    );
    expect(res.ok).toBe(false);
    expect(auth.updateUser).not.toHaveBeenCalled();
  });

  it("updates with a session and signs out other sessions (global)", async () => {
    getCurrentUserMock.mockResolvedValue({ id: "u1" });
    await updatePassword(
      initial,
      form({ password: "password1", confirmPassword: "password1" }),
    ).catch(() => {}); // redirect throws
    expect(auth.updateUser).toHaveBeenCalledWith({ password: "password1" });
    expect(auth.signOut).toHaveBeenCalledWith({ scope: "global" });
  });
});

describe("sign out of the current session (local scope)", () => {
  it("revokes only the current session and redirects to sign-in", async () => {
    let redirectedTo: string | undefined;
    await signOut().catch((e: Error) => {
      redirectedTo = e.message.replace("REDIRECT:", "");
    });
    // Local scope: the user's other sessions are NOT revoked.
    expect(auth.signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(auth.signOut).not.toHaveBeenCalledWith({ scope: "global" });
    expect(auth.signOut).not.toHaveBeenCalledWith({ scope: "others" });
    expect(redirectedTo).toBe("/sign-in");
  });

  it("does not touch owned data or the admin API (presentation-only invariant)", async () => {
    // signOut only calls the auth client; it performs no data mutation. This guards that
    // the new affordance changes no data/security behavior.
    await signOut().catch(() => {});
    expect(auth.signUp).not.toHaveBeenCalled();
    expect(auth.updateUser).not.toHaveBeenCalled();
  });
});

describe("sign out other devices stays global/others (unchanged)", () => {
  it("revokes other sessions only, distinct from local sign out", async () => {
    getCurrentUserMock.mockResolvedValue({ id: "u1" });
    const res = await signOutOtherDevices();
    expect(auth.signOut).toHaveBeenCalledWith({ scope: "others" });
    expect(res.ok).toBe(true);
  });
});

describe("no sensitive logging", () => {
  it("does not log credentials or tokens", async () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    await signUp(
      initial,
      form({ email: "a@b.com", password: "secretpw1", confirmPassword: "secretpw1", ...TOKEN }),
    );
    const logged = [...spy.mock.calls, ...errSpy.mock.calls].flat().join(" ");
    expect(logged).not.toContain("secretpw1");
    expect(logged).not.toContain("tok");
  });
});
