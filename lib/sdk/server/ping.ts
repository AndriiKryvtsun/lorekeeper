import "server-only";

import { fakeAAdapter } from "@/lib/sdk/capabilities/ping/adapters/fake-a";
import { fakeBAdapter } from "@/lib/sdk/capabilities/ping/adapters/fake-b";
import type { PingPort, PingResult } from "@/lib/sdk/capabilities/ping/port";
import { Registry } from "@/lib/sdk/core/registry";
import type { SelectionConfig } from "@/lib/sdk/core/types";
import { env } from "~/env";

// Server-only wiring for the ping capability: the ONLY place env-driven selection is read.
// The isomorphic port/adapters/registry are reused unchanged; only the SelectionConfig is
// supplied from `~/env` here. Switching providers is a `~/env` change, not a code change.

const pingRegistry = new Registry<PingPort>("ping")
  .register("a", fakeAAdapter)
  .register("b", fakeBAdapter);

function pingSelection(): SelectionConfig {
  // `?? "a"` mirrors the env schema default so the capability also works when env
  // validation is skipped (e.g. unit tests) without a configured value.
  const active = env.PING_PROVIDER ?? "a";
  const fallback = env.PING_FALLBACK
    ? env.PING_FALLBACK.split(",")
        .map((id) => id.trim())
        .filter(Boolean)
    : undefined;
  return { active, fallback };
}

// Invoke the active provider (with ordered fallback) for the ping capability.
export function ping(message: string): Promise<PingResult> {
  return pingRegistry.callWithFallback(pingSelection(), (adapter) =>
    adapter.ping(message),
  );
}
