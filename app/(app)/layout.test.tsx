import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock the auth helper and Next's redirect (which throws in real usage to halt rendering).
vi.mock("@/lib/auth/getCurrentUser", () => ({ getCurrentUser: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
}));

const { getCurrentUser } = await import("@/lib/auth/getCurrentUser");
const { redirect } = await import("next/navigation");
const AppLayout = (await import("./layout")).default;

const authMock = getCurrentUser as unknown as ReturnType<typeof vi.fn>;
const redirectMock = redirect as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("(app) layout auth guard", () => {
  it("redirects anonymous users to /login", async () => {
    authMock.mockResolvedValue(null);
    await expect(
      AppLayout({ children: null }),
    ).rejects.toThrow("REDIRECT:/login");
    expect(redirectMock).toHaveBeenCalledWith("/login");
  });

  it("renders children for an authenticated user", async () => {
    authMock.mockResolvedValue({ id: "user-1" });
    await AppLayout({ children: "ok" });
    expect(redirectMock).not.toHaveBeenCalled();
  });
});
