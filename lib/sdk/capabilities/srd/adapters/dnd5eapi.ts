import { z } from "zod";

import type { SrdCandidate, SrdPort } from "@/lib/sdk/capabilities/srd/port";
import type { CircuitBreaker } from "@/lib/sdk/http/circuit-breaker";
import { request } from "@/lib/sdk/http/transport";
import { createNpcSchema } from "@/lib/validation/npc";

// dnd5eapi.co adapter (fallback SRD provider). The name-filter endpoint returns index refs;
// detail is fetched per match (bounded) to map AC/HP/CR. Untrusted → Zod-validated and mapped
// into the NPC create schema at this boundary.

const DND5E_ATTRIBUTION =
  "Open Game Content via the D&D 5e API (dnd5eapi.co), used under the OGL 1.0a.";

const MAX_DETAILS = 5;

const listRef = z.object({ index: z.string().min(1), name: z.string().min(1) });
const dnd5eList = z.object({ results: z.array(listRef).default([]) });

const dnd5eMonster = z.object({
  name: z.string().min(1),
  size: z.string().optional(),
  type: z.string().optional(),
  armor_class: z
    .union([z.number(), z.array(z.object({ value: z.number() }))])
    .optional(),
  hit_points: z.number().optional(),
  challenge_rating: z.number().optional(),
});

function armorClass(ac: z.infer<typeof dnd5eMonster>["armor_class"]): number | undefined {
  if (typeof ac === "number") return ac;
  if (Array.isArray(ac) && ac[0]) return ac[0].value;
  return undefined;
}

function describe(m: z.infer<typeof dnd5eMonster>): string | undefined {
  const parts: string[] = [];
  const ac = armorClass(m.armor_class);
  if (ac !== undefined) parts.push(`AC ${ac}`);
  if (m.hit_points !== undefined) parts.push(`HP ${m.hit_points}`);
  if (m.challenge_rating !== undefined) parts.push(`CR ${m.challenge_rating}`);
  return parts.length ? parts.join(" · ") : undefined;
}

function toCandidate(raw: unknown): SrdCandidate | null {
  const parsed = dnd5eMonster.safeParse(raw);
  if (!parsed.success) return null;
  const m = parsed.data;
  const role = [m.size, m.type].filter(Boolean).join(" ") || undefined;
  const data = createNpcSchema.safeParse({
    name: m.name,
    role,
    description: describe(m),
    status: "alive",
  });
  if (!data.success) return null;
  return { source: "srd", attribution: DND5E_ATTRIBUTION, label: m.name, data: data.data };
}

export function createDnd5eApiAdapter(
  baseUrl: string,
  circuit: CircuitBreaker,
): SrdPort {
  const ctx = { capability: "srd", providerId: "dnd5eapi" };
  const get = (path: string) =>
    request(`${baseUrl}${path}`, { method: "GET" }, ctx, {
      timeoutMs: 8_000,
      idempotent: true,
      circuit,
    });
  return {
    async lookup(query) {
      const listRes = await get(`/monsters?name=${encodeURIComponent(query)}`);
      const refs = dnd5eList.parse(await listRes.json()).results.slice(0, MAX_DETAILS);
      const candidates = await Promise.all(
        refs.map(async (ref) => {
          const detailRes = await get(`/monsters/${ref.index}`);
          return toCandidate(await detailRes.json());
        }),
      );
      return candidates.filter((c): c is SrdCandidate => c !== null);
    },
  };
}
