import type { User } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock the owner-scoped data layer; the router must always key on ctx.user.id, never input.
vi.mock("@/lib/data/profile", () => ({ getProfile: vi.fn(), upsertProfile: vi.fn() }));

const data = await import("@/lib/data/profile");
const { profileRouter } = await import("~/server/api/routers/profile");
const { createCallerFactory } = await import("~/server/api/trpc");

const createCaller = createCallerFactory(profileRouter);
const m = (fn: unknown) => fn as ReturnType<typeof vi.fn>;
const USER = { id: "user-1" } as unknown as User;
const authed = () => createCaller({ user: USER });
const anon = () => createCaller({ user: null });

beforeEach(() => {
  vi.clearAllMocks();
  m(data.upsertProfile).mockResolvedValue({ userId: "user-1" });
  m(data.getProfile).mockResolvedValue({ userId: "user-1", displayName: "Me" });
});

describe("profileRouter self-scoping", () => {
  it("rejects anonymous callers", async () => {
    await expect(anon().getMyProfile()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(data.getProfile).not.toHaveBeenCalled();
  });

  it("getMyProfile reads the session user's profile", async () => {
    await authed().getMyProfile();
    expect(data.getProfile).toHaveBeenCalledWith("user-1");
  });

  it("updateMyProfile uses ctx.user.id and ignores any injected userId", async () => {
    await authed().updateMyProfile({
      displayName: "Bob",
      // @ts-expect-error — userId is not part of the schema; it must be stripped/ignored.
      userId: "attacker",
    });
    expect(data.upsertProfile).toHaveBeenCalledWith("user-1", { displayName: "Bob" });
    const [, payload] = m(data.upsertProfile).mock.calls[0]!;
    expect(payload).not.toHaveProperty("userId");
  });

  it("setAvatar rejects a disallowed type (SVG) and never stores it", async () => {
    await expect(
      authed().setAvatar({ contentType: "image/svg+xml" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(data.upsertProfile).not.toHaveBeenCalled();
  });

  it("setAvatar derives the path from ctx.user.id for an allowed type", async () => {
    await authed().setAvatar({ contentType: "image/png" });
    const [userId, payload] = m(data.upsertProfile).mock.calls[0]!;
    expect(userId).toBe("user-1");
    expect((payload as { avatarUrl: string }).avatarUrl).toContain(
      "/avatars/user-1/avatar.png",
    );
  });
});
