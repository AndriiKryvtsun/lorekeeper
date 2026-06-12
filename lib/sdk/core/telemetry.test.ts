import { afterEach, describe, expect, it } from "vitest";

import {
  recordTelemetry,
  resetTelemetrySink,
  setTelemetrySink,
  type TelemetryEvent,
} from "@/lib/sdk/core/telemetry";
import { request } from "@/lib/sdk/http/transport";

afterEach(() => resetTelemetrySink());

const ALLOWED_KEYS = new Set([
  "capability",
  "providerId",
  "outcome",
  "latencyMs",
  "status",
  "errorType",
]);

describe("telemetry redaction", () => {
  it("emits only allow-listed, non-sensitive fields", () => {
    const events: TelemetryEvent[] = [];
    setTelemetrySink((e) => events.push(e));

    recordTelemetry({
      capability: "test",
      providerId: "p",
      outcome: "success",
      latencyMs: 12,
      status: 200,
    });

    expect(events).toHaveLength(1);
    for (const key of Object.keys(events[0])) {
      expect(ALLOWED_KEYS.has(key)).toBe(true);
    }
  });

  it("a transport call records a metric tagged by capability + provider, with no payload", async () => {
    const events: TelemetryEvent[] = [];
    setTelemetrySink((e) => events.push(e));

    const secret = "sk-super-secret-token";
    const fetchImpl = (async () =>
      new Response("ok", { status: 200 })) as typeof fetch;

    await request(
      "https://x.test",
      { headers: { authorization: `Bearer ${secret}` }, body: secret },
      { capability: "test", providerId: "p" },
      { fetchImpl },
    );

    expect(events).toHaveLength(1);
    const event = events[0];
    expect(event).toMatchObject({
      capability: "test",
      providerId: "p",
      outcome: "success",
      status: 200,
    });
    // The secret (sent in headers/body) never appears in telemetry.
    const serialized = JSON.stringify(event);
    expect(serialized).not.toContain(secret);
    for (const key of Object.keys(event)) {
      expect(ALLOWED_KEYS.has(key)).toBe(true);
    }
  });
});
