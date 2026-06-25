import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createDnd5eApiAdapter } from "@/lib/sdk/capabilities/srd/adapters/dnd5eapi";
import { createOpen5eAdapter } from "@/lib/sdk/capabilities/srd/adapters/open5e";
import type { SrdPort } from "@/lib/sdk/capabilities/srd/port";
import { Registry } from "@/lib/sdk/core/registry";
import { CircuitBreaker } from "@/lib/sdk/http/circuit-breaker";

// Adapters call the shared transport, which uses global fetch. We stub fetch per test and
// branch on the requested URL so we can simulate one provider failing and another succeeding.

const OPEN5E = "https://open5e.test";
const DND5E = "https://dnd5e.test";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const goblinOpen5e = {
  results: [
    {
      name: "Goblin",
      size: "Small",
      type: "humanoid",
      armor_class: 15,
      hit_points: 7,
      challenge_rating: "1/4",
    },
  ],
};

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("Open5e adapter mapping and validation", () => {
  it("maps a valid monster into a committable NPC candidate", async () => {
    fetchMock.mockResolvedValue(json(goblinOpen5e));
    const circuit = new CircuitBreaker({ failureThreshold: 5, cooldownMs: 1000 });
    const adapter = createOpen5eAdapter(OPEN5E, circuit);

    const candidates = await adapter.lookup("goblin");

    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({
      source: "srd",
      label: "Goblin",
      data: { name: "Goblin", role: "Small humanoid", status: "alive" },
    });
    expect(candidates[0]!.data.description).toContain("AC 15");
    expect(candidates[0]!.attribution).toMatch(/OGL/i);
  });

  it("drops malformed entries (untrusted data is rejected at the boundary)", async () => {
    // `name` missing → fails the monster schema → dropped.
    fetchMock.mockResolvedValue(json({ results: [{ armor_class: 12 }] }));
    const circuit = new CircuitBreaker({ failureThreshold: 5, cooldownMs: 1000 });
    const adapter = createOpen5eAdapter(OPEN5E, circuit);

    expect(await adapter.lookup("nonsense")).toEqual([]);
  });

  it("rejects a structurally invalid response body", async () => {
    fetchMock.mockResolvedValue(json({ unexpected: true }));
    const circuit = new CircuitBreaker({ failureThreshold: 5, cooldownMs: 1000 });
    const adapter = createOpen5eAdapter(OPEN5E, circuit);

    await expect(adapter.lookup("x")).rejects.toBeTruthy();
  });
});

describe("ordered fallback: Open5e down → dnd5eapi", () => {
  it("returns the fallback provider's candidate when the primary fails", async () => {
    fetchMock.mockImplementation((url: string | URL) => {
      const u = String(url);
      if (u.startsWith(OPEN5E)) return Promise.resolve(json("upstream boom", 500));
      if (u.includes("/monsters?name=")) {
        return Promise.resolve(json({ results: [{ index: "goblin", name: "Goblin" }] }));
      }
      // detail
      return Promise.resolve(
        json({ name: "Goblin", size: "Small", type: "humanoid", armor_class: 15, hit_points: 7, challenge_rating: 0.25 }),
      );
    });

    const circuit = new CircuitBreaker({ failureThreshold: 5, cooldownMs: 1000 });
    const registry = new Registry<SrdPort>("srd")
      .register("open5e", createOpen5eAdapter(OPEN5E, circuit))
      .register("dnd5eapi", createDnd5eApiAdapter(DND5E, circuit));

    const result = await registry.callWithFallback(
      { active: "open5e", fallback: ["dnd5eapi"] },
      (adapter) => adapter.lookup("goblin"),
    );

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ source: "srd", label: "Goblin" });
    expect(result[0]!.data.name).toBe("Goblin");
  });
});

describe("circuit breaker", () => {
  it("opens after the failure threshold and short-circuits further calls", async () => {
    fetchMock.mockResolvedValue(json("boom", 500));
    const circuit = new CircuitBreaker({ failureThreshold: 2, cooldownMs: 10_000 });
    const adapter = createOpen5eAdapter(OPEN5E, circuit);

    await expect(adapter.lookup("a")).rejects.toBeTruthy(); // failure 1
    await expect(adapter.lookup("b")).rejects.toBeTruthy(); // failure 2 → opens
    const callsBefore = fetchMock.mock.calls.length;

    // Third call short-circuits with CircuitOpenError — no further fetch is attempted.
    await expect(adapter.lookup("c")).rejects.toMatchObject({ name: "CircuitOpenError" });
    expect(fetchMock.mock.calls.length).toBe(callsBefore);
  });
});
