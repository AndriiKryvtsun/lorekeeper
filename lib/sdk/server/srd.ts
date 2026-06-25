import "server-only";

import { createDnd5eApiAdapter } from "@/lib/sdk/capabilities/srd/adapters/dnd5eapi";
import { createOpen5eAdapter } from "@/lib/sdk/capabilities/srd/adapters/open5e";
import type { SrdCandidate, SrdPort } from "@/lib/sdk/capabilities/srd/port";
import { Registry } from "@/lib/sdk/core/registry";
import type { SelectionConfig } from "@/lib/sdk/core/types";
import { CircuitBreaker } from "@/lib/sdk/http/circuit-breaker";
import { env } from "~/env";

// Server-only wiring for the SRD capability: the ONLY place env-driven selection + base URLs
// are read. One shared per-provider circuit breaker is reused across calls. Switching the
// primary provider or its fallback is a `~/env` change, not a code change.

const circuit = new CircuitBreaker({ failureThreshold: 5, cooldownMs: 30_000 });

const registry = new Registry<SrdPort>("srd")
  .register("open5e", createOpen5eAdapter(env.OPEN5E_BASE_URL, circuit))
  .register("dnd5eapi", createDnd5eApiAdapter(env.DND5EAPI_BASE_URL, circuit));

function srdSelection(): SelectionConfig {
  const active = env.SRD_PROVIDER ?? "open5e";
  const fallback = env.SRD_FALLBACK
    ? env.SRD_FALLBACK.split(",").map((id) => id.trim()).filter(Boolean)
    : ["dnd5eapi"];
  return { active, fallback };
}

// Look up SRD monsters with ordered provider fallback. Returns [] (no match) rather than
// throwing when a provider responds successfully with no results.
export function lookupSrd(query: string): Promise<SrdCandidate[]> {
  return registry.callWithFallback(srdSelection(), (adapter) => adapter.lookup(query));
}
