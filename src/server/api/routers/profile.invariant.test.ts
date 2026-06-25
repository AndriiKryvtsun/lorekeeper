import { describe, expect, it, vi } from "vitest";

// Presentation-only invariant: this change adds visual polish + a user menu + a local-scope
// sign-out affordance, and must NOT add or alter any tRPC procedure surface. This test pins
// the profile router's procedure set so an accidental data/procedure change fails loudly.
vi.mock("@/lib/data/profile", () => ({ getProfile: vi.fn(), upsertProfile: vi.fn() }));

const { profileRouter } = await import("~/server/api/routers/profile");

describe("presentation-only: tRPC surface is unchanged", () => {
  it("profile router exposes exactly its existing procedures", () => {
    const procedures = profileRouter._def.procedures as Record<string, unknown>;
    expect(Object.keys(procedures).sort()).toEqual(
      ["getMyProfile", "setAvatar", "updateMyProfile"].sort(),
    );
  });
});
