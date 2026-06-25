import { z } from "zod";

import type { SrdCandidate, SrdPort } from "@/lib/sdk/capabilities/srd/port";
import type { CircuitBreaker } from "@/lib/sdk/http/circuit-breaker";
import { request } from "@/lib/sdk/http/transport";
import { createNpcSchema } from "@/lib/validation/npc";

// Open5e adapter (primary SRD provider). Plain REST over the shared transport — no vendor SDK.
// Retrieved data is UNTRUSTED: the response is Zod-validated and mapped into the NPC create
// schema at this boundary; anything that fails validation is dropped.

const OPEN5E_ATTRIBUTION =
  "Open Game Content via Open5e (api.open5e.com), used under the OGL 1.0a / CC-BY-4.0.";

const open5eMonster = z.object({
  name: z.string().min(1),
  size: z.string().optional(),
  type: z.string().optional(),
  armor_class: z.number().optional(),
  hit_points: z.number().optional(),
  challenge_rating: z.string().optional(),
});

const open5eList = z.object({
  results: z.array(z.unknown()),
});

// Compose a concise, plain-text description from the monster's headline stats.
function describe(m: z.infer<typeof open5eMonster>): string | undefined {
  const parts: string[] = [];
  if (m.armor_class !== undefined) parts.push(`AC ${m.armor_class}`);
  if (m.hit_points !== undefined) parts.push(`HP ${m.hit_points}`);
  if (m.challenge_rating !== undefined) parts.push(`CR ${m.challenge_rating}`);
  return parts.length ? parts.join(" · ") : undefined;
}

function toCandidate(raw: unknown): SrdCandidate | null {
  const parsed = open5eMonster.safeParse(raw);
  if (!parsed.success) return null;
  const m = parsed.data;
  const role = [m.size, m.type].filter(Boolean).join(" ") || undefined;
  // Re-validate the mapped fields against the real create schema so the candidate is committable.
  const data = createNpcSchema.safeParse({
    name: m.name,
    role,
    description: describe(m),
    status: "alive",
  });
  if (!data.success) return null;
  return { source: "srd", attribution: OPEN5E_ATTRIBUTION, label: m.name, data: data.data };
}

export function createOpen5eAdapter(
  baseUrl: string,
  circuit: CircuitBreaker,
): SrdPort {
  const ctx = { capability: "srd", providerId: "open5e" };
  return {
    async lookup(query) {
      const url = `${baseUrl}/monsters/?search=${encodeURIComponent(query)}&limit=5&format=json`;
      const res = await request(url, { method: "GET" }, ctx, {
        timeoutMs: 8_000,
        idempotent: true, // pure GET — safe to retry
        circuit,
      });
      const body = open5eList.parse(await res.json()); // untrusted → validate shape
      return body.results
        .map(toCandidate)
        .filter((c): c is SrdCandidate => c !== null);
    },
  };
}
