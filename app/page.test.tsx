import { readFileSync } from "node:fs";
import { join } from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock auth + Next's redirect (which throws to halt rendering).
vi.mock("@/lib/auth/getCurrentUser", () => ({ getCurrentUser: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
}));

const { getCurrentUser } = await import("@/lib/auth/getCurrentUser");
const { redirect } = await import("next/navigation");
const { Landing } = await import("@/components/landing/landing");
const HomePage = (await import("./page")).default;
const { generateMetadata } = await import("./page");

const authMock = getCurrentUser as unknown as ReturnType<typeof vi.fn>;
const redirectMock = redirect as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => vi.clearAllMocks());

describe("home route auth-state routing", () => {
  it("redirects an authenticated visitor to /campaigns (landing not rendered)", async () => {
    authMock.mockResolvedValue({ id: "user-1" });
    await expect(HomePage()).rejects.toThrow("REDIRECT:/campaigns");
    expect(redirectMock).toHaveBeenCalledWith("/campaigns");
  });

  it("renders the landing for an anonymous visitor", async () => {
    authMock.mockResolvedValue(null);
    const el = await HomePage();
    expect(redirectMock).not.toHaveBeenCalled();
    expect(el.type).toBe(Landing);
  });
});

describe("home metadata + indexability", () => {
  it("provides title, description, canonical, OG/Twitter and marks / indexable", () => {
    const md = generateMetadata();
    expect(md.title).toBeTruthy();
    expect(md.description).toBeTruthy();
    expect(md.alternates?.canonical).toBe("/");
    expect(md.robots).toMatchObject({ index: true });
    expect(md.openGraph?.url).toBe("/");
    expect(md.twitter).toMatchObject({ card: "summary_large_image" });
  });

  it("keeps the rest of the app noindex by default (root layout)", () => {
    const layout = readFileSync(join(process.cwd(), "app", "layout.tsx"), "utf8");
    expect(layout).toMatch(/robots:\s*\{\s*index:\s*false/);
  });
});

describe("no client-side secret usage on the landing", () => {
  const SECRETS = [
    "SUPABASE_SERVICE_ROLE_KEY",
    "ANTHROPIC_API_KEY",
    "OPENAI_API_KEY",
    "GROQ_API_KEY",
  ];
  for (const file of ["app/page.tsx", "components/landing/landing.tsx"]) {
    it(`${file} references no secrets and (landing) is a server component`, () => {
      const src = readFileSync(join(process.cwd(), file), "utf8");
      for (const secret of SECRETS) expect(src).not.toContain(secret);
      if (file.endsWith("landing.tsx")) {
        expect(src).not.toContain('"use client"');
      }
    });
  }
});
